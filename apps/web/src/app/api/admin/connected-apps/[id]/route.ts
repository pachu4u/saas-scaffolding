import { auth } from '@platform/auth';
import { adminDb, type Prisma } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

// Blank input should clear the field to null, not store an empty string —
// `??` wouldn't do that since '' is neither null nor undefined.
function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return trimmed ? trimmed : null;
}

/**
 * GET /api/admin/connected-apps/[id]
 * Full detail: app config, every tenant instance (SCIM wiring + sync health),
 * and the app-scoped roles available to any tenant that connects it.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const app = await adminDb.connectedApp.findUnique({
    where: { id },
    include: {
      instances: {
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      },
      roles: {
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
          _count: { select: { bindings: true } },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    iconUrl: app.iconUrl,
    docsUrl: app.docsUrl,
    config: app.config,
    status: app.status,
    instances: app.instances.map((instance) => ({
      id: instance.id,
      tenantId: instance.tenantId,
      tenantName: instance.tenant.name,
      tenantSlug: instance.tenant.slug,
      scimBaseUrl: instance.scimBaseUrl,
      status: instance.status,
      lastSyncedAt: instance.lastSyncedAt,
      lastSyncError: instance.lastSyncError,
    })),
    roles: app.roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      memberCount: role._count.bindings,
      permissions: role.permissions.map((rp) => rp.permission.code),
    })),
  });
}

/**
 * PATCH /api/admin/connected-apps/[id]
 * Body: partial { name, description, iconUrl, docsUrl, config, status }
 * Updates registry-level config. Per-tenant SCIM base URL/token live on
 * ConnectedAppInstance and aren't editable here.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await adminDb.connectedApp.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as {
    name?: string;
    description?: string | null;
    iconUrl?: string | null;
    docsUrl?: string | null;
    config?: Record<string, unknown>;
    status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
  };

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 422 });
  }

  const app = await adminDb.connectedApp.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: trimmedOrNull(body.description) }),
      ...(body.iconUrl !== undefined && { iconUrl: trimmedOrNull(body.iconUrl) }),
      ...(body.docsUrl !== undefined && { docsUrl: trimmedOrNull(body.docsUrl) }),
      ...(body.config !== undefined && { config: body.config as Prisma.InputJsonValue }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json({ id: app.id, slug: app.slug, name: app.name, status: app.status });
}

/**
 * DELETE /api/admin/connected-apps/[id]
 * Blocked while any tenant instance still exists — deregister those first so
 * an admin can't accidentally sever a live SCIM sync by deleting the app.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const app = await adminDb.connectedApp.findUnique({
    where: { id },
    include: { _count: { select: { instances: true } } },
  });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (app._count.instances > 0) {
    return NextResponse.json(
      { error: 'Remove all tenant instances of this app before deleting it' },
      { status: 409 },
    );
  }

  await adminDb.connectedApp.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
