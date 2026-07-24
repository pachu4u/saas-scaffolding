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
 * Body: { name: string }
 * Defines a role name that only makes sense for this connected app — it
 * becomes available (as a system role) to every tenant that connects the
 * app, and syncs to that app's SCIM Groups. What the role actually grants is
 * configured inside the app itself, not here — the platform only tracks the
 * role's existence and its membership.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId } = await params;
  const app = await adminDb.connectedApp.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 });

  const body = (await req.json()) as { name?: string };
  const { name } = body;

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

  const role = await adminDb.role.create({
    data: { tenantId: null, appId, name: name.trim(), isSystem: true },
  });

  return NextResponse.json(
    { id: role.id, name: role.name, isSystem: role.isSystem },
    { status: 201 },
  );
}
