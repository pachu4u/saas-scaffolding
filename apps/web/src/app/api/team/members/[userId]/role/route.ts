import { PLATFORM_ROLE_NAMES, Permission, invalidateAuthzCache, withAuthz } from '@platform/authz';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/members/[userId]/role
 * Body: { roleId: string } — actually a role *name* (e.g. "tenant_admin"),
 * matching the convention already used by POST /api/team/invite.
 * Replaces the member's existing role binding(s) in this tenant with the
 * selected role. Requires USERS_UPDATE.
 */
export const PATCH = withAuthz<{ params: Promise<{ userId: string }> }>(
  { permission: Permission.USERS_UPDATE },
  async (req: NextRequest, { authz, params }) => {
    const { userId } = await params;
    const body = (await req.json()) as { roleId?: string };
    const roleName = body.roleId;
    if (!roleName) return NextResponse.json({ error: 'roleId is required' }, { status: 422 });

    // Platform-level roles (platform_super_admin, platform_support) are
    // never assignable from within a tenant's own team management.
    if ((PLATFORM_ROLE_NAMES as readonly string[]).includes(roleName)) {
      return NextResponse.json(
        { error: `Role "${roleName}" cannot be assigned within a tenant` },
        { status: 403 },
      );
    }

    const tenantUser = await adminDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: authz.tenantId, userId } },
    });
    if (!tenantUser) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const role = await adminDb.role.findFirst({ where: { name: roleName } });
    if (!role) return NextResponse.json({ error: `Unknown role "${roleName}"` }, { status: 422 });

    await withPlatformAdmin(async (tx) => {
      await tx.roleBinding.deleteMany({ where: { tenantId: authz.tenantId, userId } });
      await tx.roleBinding.create({
        data: { tenantId: authz.tenantId, userId, roleId: role.id },
      });

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'member.role_changed',
          resourceType: 'TenantUser',
          resourceId: userId,
          after: { role: roleName },
        },
      });
    });

    // The old role's permissions are cached for up to 120s — invalidate so a
    // role change (especially a downgrade) takes effect immediately.
    await invalidateAuthzCache(authz.tenantId, userId);

    return NextResponse.json({ ok: true });
  },
);
