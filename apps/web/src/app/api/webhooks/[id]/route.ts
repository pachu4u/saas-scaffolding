import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

async function resolveEndpoint(req: NextRequest, id: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug)
    return { error: NextResponse.json({ error: 'No tenant context' }, { status: 400 }) };

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx)
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };

  const endpoint = await adminDb.webhookEndpoint.findFirst({
    where: { id, tenantId: tenantCtx.tenantId, status: { not: 'DELETED' } },
  });

  if (!endpoint)
    return { error: NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }) };

  return { endpoint };
}

/**
 * PATCH /api/webhooks/[id]
 * Body: { url?: string; events?: string[]; status?: 'ACTIVE' | 'PAUSED' }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await resolveEndpoint(req, id);
  if (resolved.error) return resolved.error;

  const body = (await req.json()) as {
    url?: string;
    events?: string[];
    status?: 'ACTIVE' | 'PAUSED';
  };

  if (body.url !== undefined) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'url must be a valid URL' }, { status: 422 });
    }
  }

  const updated = await adminDb.webhookEndpoint.update({
    where: { id },
    data: {
      ...(body.url !== undefined && { url: body.url }),
      ...(body.events !== undefined && { events: body.events }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/webhooks/[id]
 * Soft-deletes the endpoint (sets status to DELETED).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await resolveEndpoint(req, id);
  if (resolved.error) return resolved.error;

  await adminDb.webhookEndpoint.update({
    where: { id },
    data: { status: 'DELETED' },
  });

  return new NextResponse(null, { status: 204 });
}
