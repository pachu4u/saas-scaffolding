import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { enqueueRoleSyncForApp } from '@/lib/role-sync';

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
 * DELETE /api/admin/connected-apps/[id]/roles/[roleId]
 * Blocked while any tenant still has members bound to this role — bindings
 * span tenants for an app-scoped role, so cascading the delete instead of
 * requiring cleanup first could quietly drop access for people in a tenant
 * the admin wasn't even looking at.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: appId, roleId } = await params;
  const role = await adminDb.role.findFirst({
    where: { id: roleId, appId },
    include: { _count: { select: { bindings: true } } },
  });
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (role._count.bindings > 0) {
    return NextResponse.json(
      { error: 'Unassign every member holding this role before deleting it' },
      { status: 409 },
    );
  }

  await adminDb.role.delete({ where: { id: roleId } });
  await enqueueRoleSyncForApp(appId);

  return new NextResponse(null, { status: 204 });
}
