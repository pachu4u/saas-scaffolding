import crypto from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

export const runtime = 'nodejs';

/**
 * POST /api/settings/api-keys
 * Body: { name: string; scopes: string[] }
 *
 * Generates a new SCIM/API token for the tenant.
 * Returns the raw token ONCE — it is not stored in cleartext.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { name?: string; scopes?: string[] };
  const { name, scopes } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'at least one scope is required' }, { status: 422 });
  }

  // Generate cryptographically secure token: scp_{32 random bytes hex}
  const rawToken = `scp_${crypto.randomBytes(32).toString('hex')}`;
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const token = await withPlatformAdmin(async (tx) => {
    const created = await tx.scimToken.create({
      data: {
        tenantId: tenantCtx.tenantId,
        name: name.trim(),
        hashedToken,
        scopes,
      },
      select: { id: true, name: true, scopes: true, createdAt: true },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: session.user.id,
        action: 'apikey.created',
        resourceType: 'ScimToken',
        resourceId: created.id,
        after: { name: created.name, scopes: created.scopes },
      },
    });

    return created;
  });

  // Return the raw token exactly once — caller must store it securely
  return NextResponse.json({ ...token, token: rawToken }, { status: 201 });
}

/**
 * DELETE /api/settings/api-keys?id=<tokenId>
 *
 * Revokes (deletes) a SCIM/API token.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });

  // Verify token belongs to this tenant
  const existing = await adminDb.scimToken.findFirst({
    where: { id, tenantId: tenantCtx.tenantId },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await withPlatformAdmin(async (tx) => {
    await tx.scimToken.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: session.user.id,
        action: 'apikey.revoked',
        resourceType: 'ScimToken',
        resourceId: id,
        before: { name: existing.name },
      },
    });
  });

  return new NextResponse(null, { status: 204 });
}
