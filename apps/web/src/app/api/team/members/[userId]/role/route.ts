import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/members/[userId]/role
 * Body: { roleId: string } — actually a role *name* (e.g. "tenant_admin"),
 * matching the convention already used by POST /api/team/invite.
 * Replaces the member's existing role binding(s) in this tenant with the
 * selected role.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { userId } = await params;
  const body = (await req.json()) as { roleId?: string };
  const roleName = body.roleId;
  if (!roleName) return NextResponse.json({ error: 'roleId is required' }, { status: 422 });

  const tenantUser = await adminDb.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId } },
  });
  if (!tenantUser) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const role = await adminDb.role.findFirst({ where: { name: roleName } });
  if (!role) return NextResponse.json({ error: `Unknown role "${roleName}"` }, { status: 422 });

  await withPlatformAdmin(async (tx) => {
    await tx.roleBinding.deleteMany({ where: { tenantId: tenantCtx.tenantId, userId } });
    await tx.roleBinding.create({
      data: { tenantId: tenantCtx.tenantId, userId, roleId: role.id },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: session.user.id,
        action: 'member.role_changed',
        resourceType: 'TenantUser',
        resourceId: userId,
        after: { role: roleName },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
