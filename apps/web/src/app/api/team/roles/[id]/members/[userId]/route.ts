import { Permission, withAuthz } from '@platform/authz';
import { adminDb, appendSyncOutbox, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { enqueueRoleSync } from '@/lib/role-sync';

export const runtime = 'nodejs';

/**
 * Resolves the target role, scoped to app-scoped roles only — this endpoint
 * is the additive counterpart to PATCH /api/team/members/[userId]/role
 * (which replaces a member's single primary role). App-scoped roles are
 * assigned on top of that primary role, so only roles with Role.appId set
 * are ever reachable here, and only when this tenant actually has an active
 * instance of that app.
 */
async function resolveAssignableAppRole(roleId: string, tenantId: string) {
  const role = await adminDb.role.findFirst({
    where: { id: roleId, tenantId: null, appId: { not: null }, isSystem: true },
  });
  if (!role?.appId) return null;

  const instance = await adminDb.connectedAppInstance.findFirst({
    where: { appId: role.appId, tenantId, status: 'ACTIVE' },
  });
  if (!instance) return null;

  return role;
}

/**
 * POST /api/team/roles/[id]/members/[userId]
 * Assigns a connected-app role to a tenant member, additively — existing
 * role bindings (the member's primary tenant role, other app roles) are
 * left untouched.
 */
export const POST = withAuthz<{ params: Promise<{ id: string; userId: string }> }>(
  { permission: Permission.USERS_UPDATE },
  async (_req: NextRequest, { authz, params }) => {
    const { id: roleId, userId } = await params;

    const role = await resolveAssignableAppRole(roleId, authz.tenantId);
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    const tenantUser = await adminDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: authz.tenantId, userId } },
    });
    if (!tenantUser) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    await withPlatformAdmin(async (tx) => {
      await tx.roleBinding.upsert({
        where: { tenantId_userId_roleId: { tenantId: authz.tenantId, userId, roleId } },
        update: {},
        create: { tenantId: authz.tenantId, userId, roleId },
      });

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'app_role.member_assigned',
          resourceType: 'Role',
          resourceId: roleId,
          after: { userId, roleName: role.name },
        },
      });

      await appendSyncOutbox(tx, authz.tenantId, [
        { resourceType: 'USER', resourceId: userId },
        { resourceType: 'GROUP', resourceId: roleId },
      ]);
    });

    await enqueueRoleSync(authz.tenantId);

    return NextResponse.json({ ok: true }, { status: 201 });
  },
);

/**
 * DELETE /api/team/roles/[id]/members/[userId]
 * Removes a connected-app role from a tenant member, leaving every other
 * role binding they hold untouched.
 */
export const DELETE = withAuthz<{ params: Promise<{ id: string; userId: string }> }>(
  { permission: Permission.USERS_UPDATE },
  async (_req: NextRequest, { authz, params }) => {
    const { id: roleId, userId } = await params;

    const role = await resolveAssignableAppRole(roleId, authz.tenantId);
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    await withPlatformAdmin(async (tx) => {
      await tx.roleBinding.deleteMany({ where: { tenantId: authz.tenantId, userId, roleId } });

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'app_role.member_unassigned',
          resourceType: 'Role',
          resourceId: roleId,
          before: { userId, roleName: role.name },
        },
      });

      await appendSyncOutbox(tx, authz.tenantId, [
        { resourceType: 'USER', resourceId: userId },
        { resourceType: 'GROUP', resourceId: roleId },
      ]);
    });

    await enqueueRoleSync(authz.tenantId);

    return new NextResponse(null, { status: 204 });
  },
);
