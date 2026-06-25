import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/team/roles
 * Returns all roles applicable to the current tenant (system + custom).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const roles = await adminDb.role.findMany({
    where: { OR: [{ tenantId: tenantCtx.tenantId }, { isSystem: true }] },
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
 * Creates a custom (tenant-scoped) role.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as { name?: string; permissions?: string[] };
  const { name, permissions = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }

  // Check name uniqueness within tenant
  const existing = await adminDb.role.findFirst({
    where: { name: name.trim(), OR: [{ tenantId: tenantCtx.tenantId }, { isSystem: true }] },
  });
  if (existing) {
    return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 });
  }

  const role = await withPlatformAdmin(async (tx) => {
    // Resolve permission IDs from codes
    const permRecords = permissions.length
      ? await tx.permission.findMany({ where: { code: { in: permissions } } })
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
        actorUserId: session.user.id,
        action: 'role.created',
        resourceType: 'Role',
        resourceId: created.id,
        after: { name: created.name, permissions },
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
}
