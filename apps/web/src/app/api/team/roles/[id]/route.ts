import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/roles/[id]
 * Body: { permissions: string[] }
 * Updates the permission set of a custom role. System roles cannot be modified.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { id } = await params;
  const role = await adminDb.role.findFirst({
    where: { id, tenantId: tenantCtx.tenantId },
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

  const updated = await withPlatformAdmin(async (tx) => {
    // Resolve permission IDs
    const permRecords = permissions.length
      ? await tx.permission.findMany({ where: { code: { in: permissions } } })
      : [];

    // Replace all permissions: delete then create
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    if (permRecords.length) {
      await tx.rolePermission.createMany({
        data: permRecords.map((p) => ({ roleId: id, permissionId: p.id })),
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: session.user.id,
        action: 'role.updated',
        resourceType: 'Role',
        resourceId: id,
        after: { permissions },
      },
    });

    return tx.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
  });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    permissions: updated.permissions.map((rp) => rp.permission.code),
  });
}

/**
 * DELETE /api/team/roles/[id]
 * Deletes a custom (non-system) role and removes all bindings.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { id } = await params;
  const role = await adminDb.role.findFirst({
    where: { id, tenantId: tenantCtx.tenantId },
  });

  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (role.isSystem) {
    return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 403 });
  }

  await withPlatformAdmin(async (tx) => {
    // Remove all bindings first, then permissions, then the role
    await tx.roleBinding.deleteMany({ where: { roleId: id, tenantId: tenantCtx.tenantId } });
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        actorUserId: session.user.id,
        action: 'role.deleted',
        resourceType: 'Role',
        resourceId: id,
        before: { name: role.name },
      },
    });
  });

  return new NextResponse(null, { status: 204 });
}
