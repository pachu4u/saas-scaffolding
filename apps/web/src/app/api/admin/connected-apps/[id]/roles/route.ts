import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
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

/**
 * POST /api/admin/connected-apps/[id]/roles
 * Body: { name: string; permissions: string[] }
 * Defines a role that only makes sense for this connected app — it becomes
 * available (as a system role) to every tenant that connects the app, and
 * syncs to that app's SCIM Groups with the given permission codes. Permission
 * codes here are opaque to the platform: they're whatever the connected app
 * itself understands, not the platform's own Permission enum.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId } = await params;
  const app = await adminDb.connectedApp.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });

  const body = (await req.json()) as { name?: string; permissions?: string[] };
  const { name, permissions = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }

  const existing = await adminDb.role.findFirst({
    where: { tenantId: null, appId, name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'A role with that name already exists for this app' },
      { status: 409 },
    );
  }

  const cleanCodes = [...new Set(permissions.map((p) => p.trim()).filter(Boolean))];

  const role = await adminDb.$transaction(async (tx) => {
    const permRecords = await Promise.all(
      cleanCodes.map((code) =>
        tx.permission.upsert({ where: { code }, update: {}, create: { code } }),
      ),
    );
    return tx.role.create({
      data: {
        tenantId: null,
        appId,
        name: name.trim(),
        isSystem: true,
        permissions: { create: permRecords.map((p) => ({ permissionId: p.id })) },
      },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
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
