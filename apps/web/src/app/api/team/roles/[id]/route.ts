import { Permission, withAuthz } from '@platform/authz';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/roles/[id]
 * Body: { permissions: string[] }
 * Updates the permission set of a custom role. System roles cannot be modified.
 * Requires USERS_UPDATE — editing a role's permissions changes what every
 * member holding that role can do.
 */
export const PATCH = withAuthz<{ params: Promise<{ id: string }> }>(
  { permission: Permission.USERS_UPDATE },
  async (req: NextRequest, { authz, params }) => {
    const { id: roleId } = await params;

    const role = await adminDb.role.findFirst({
      where: { id: roleId, tenantId: authz.tenantId },
    });

    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (role.isSystem) {
      return NextResponse.json({ error: 'System roles cannot be modified' }, { status: 403 });
    }

    const body = (await req.json()) as { permissions?: string[]; name?: string };
    const { permissions } = body;

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions array is required' }, { status: 422 });
    }

    // A tenant can never grant PLATFORM_ADMIN through a custom role.
    const requestedPermissions = permissions.filter((p) => p !== Permission.PLATFORM_ADMIN);

    const updated = await withPlatformAdmin(async (tx) => {
      // Resolve permission IDs
      const permRecords = requestedPermissions.length
        ? await tx.permission.findMany({ where: { code: { in: requestedPermissions } } })
        : [];

      // Replace all permissions: delete then create
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permRecords.length) {
        await tx.rolePermission.createMany({
          data: permRecords.map((p) => ({ roleId, permissionId: p.id })),
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'role.updated',
          resourceType: 'Role',
          resourceId: roleId,
          after: { permissions: requestedPermissions },
        },
      });

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: { select: { code: true } } } } },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      permissions: updated.permissions.map((rp) => rp.permission.code),
    });
  },
);

/**
 * DELETE /api/team/roles/[id]
 * Deletes a custom (non-system) role and removes all bindings.
 * Requires USERS_UPDATE, same as editing a role's permissions.
 */
export const DELETE = withAuthz<{ params: Promise<{ id: string }> }>(
  { permission: Permission.USERS_UPDATE },
  async (req: NextRequest, { authz, params }) => {
    const { id: roleId } = await params;

    const role = await adminDb.role.findFirst({
      where: { id: roleId, tenantId: authz.tenantId },
    });

    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (role.isSystem) {
      return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 403 });
    }

    await withPlatformAdmin(async (tx) => {
      // Remove all bindings first, then permissions, then the role
      await tx.roleBinding.deleteMany({ where: { roleId, tenantId: authz.tenantId } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });

      await tx.auditLog.create({
        data: {
          tenantId: authz.tenantId,
          actorUserId: authz.user.id,
          action: 'role.deleted',
          resourceType: 'Role',
          resourceId: roleId,
          before: { name: role.name },
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  },
);
