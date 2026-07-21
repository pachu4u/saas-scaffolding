import { auth } from '@platform/auth';
import { PLATFORM_ROLE_NAMES, Permission, withAuthz } from '@platform/authz';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../../lib/server-tenant';

export const runtime = 'nodejs';

/**
 * GET /api/team/roles
 * Returns all roles applicable to the current tenant (system + custom).
 * Platform-level system roles (platform_super_admin, platform_support) are
 * excluded — they're not relevant to a single tenant's role management.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // App-scoped system roles only apply to tenants that actually connect that
  // app — otherwise every tenant would see roles meaningful only to apps they
  // don't have.
  const connectedAppIds = (
    await adminDb.connectedAppInstance.findMany({
      where: { tenantId: tenantCtx.tenantId, status: 'ACTIVE' },
      select: { appId: true },
    })
  ).map((instance) => instance.appId);

  const roles = await adminDb.role.findMany({
    where: {
      OR: [
        { tenantId: tenantCtx.tenantId },
        { isSystem: true, appId: null, name: { notIn: [...PLATFORM_ROLE_NAMES] } },
        { isSystem: true, appId: { in: connectedAppIds } },
      ],
    },
    include: {
      permissions: { include: { permission: { select: { id: true, code: true } } } },
      _count: { select: { bindings: { where: { tenantId: tenantCtx.tenantId } } } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      memberCount: r._count.bindings,
      permissions: r.permissions.map((rp) => rp.permission.code),
    })),
  );
}

/**
 * POST /api/team/roles
 * Body: { name: string; permissions: string[] }
 * Creates a custom (tenant-scoped) role. Requires USERS_UPDATE — creating a
 * role that can be granted to members is equivalent to changing what members
 * can do, so it needs the same permission as changing a member's role.
 */
export const POST = withAuthz({ permission: Permission.USERS_UPDATE }, async (req, { authz }) => {
  const tenantCtx = { tenantId: authz.tenantId };

  const body = (await req.json()) as { name?: string; permissions?: string[] };
  const { name, permissions = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }

  // A tenant can never grant PLATFORM_ADMIN through a custom role — that
  // permission is only meaningful at the platform level.
  const requestedPermissions = permissions.filter((p) => p !== Permission.PLATFORM_ADMIN);

  // Check name uniqueness within tenant
  const existing = await adminDb.role.findFirst({
    where: { name: name.trim(), OR: [{ tenantId: tenantCtx.tenantId }, { isSystem: true }] },
  });
  if (existing) {
    return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 });
  }

  const role = await withPlatformAdmin(async (tx) => {
    // Resolve permission IDs from codes
    const permRecords = requestedPermissions.length
      ? await tx.permission.findMany({ where: { code: { in: requestedPermissions } } })
      : [];

    const created = await tx.role.create({
      data: {
        name: name.trim(),
        tenantId: tenantCtx.tenantId,
        isSystem: false,
        permissions: {
          create: permRecords.map((p) => ({ permissionId: p.id })),
        },
      },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: authz.user.id,
        action: 'role.created',
        resourceType: 'Role',
        resourceId: created.id,
        after: { name: created.name, permissions: requestedPermissions },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.code),
    },
    { status: 201 },
  );
});
