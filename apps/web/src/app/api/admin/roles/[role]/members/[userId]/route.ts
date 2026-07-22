import { auth } from '@platform/auth';
import { PLATFORM_ROLE_NAMES } from '@platform/authz';
import { type NextRequest, NextResponse } from 'next/server';

import { listGroupMembers, removeUserFromGroup } from '@/lib/keycloak-admin';

export const runtime = 'nodejs';

function isPlatformSuperAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) && (session.groups as string[]).includes('platform_super_admin')
  );
}

function isPlatformRole(value: string): value is (typeof PLATFORM_ROLE_NAMES)[number] {
  return (PLATFORM_ROLE_NAMES as readonly string[]).includes(value);
}

/**
 * DELETE /api/admin/roles/[role]/members/[userId]
 * Revokes a platform role. Refuses to remove the last platform_super_admin —
 * Keycloak group membership is the only gate on admin access (see
 * (admin)/layout.tsx), so emptying the group locks everyone out with no
 * recovery path short of a direct DB/Keycloak console edit.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ role: string; userId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformSuperAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role, userId } = await params;
  if (!isPlatformRole(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 404 });

  try {
    if (role === 'platform_super_admin') {
      const members = await listGroupMembers(role);
      if (members.length <= 1 && members.some((m) => m.id === userId)) {
        return NextResponse.json(
          { error: 'Cannot remove the last platform super admin' },
          { status: 409 },
        );
      }
    }
    await removeUserFromGroup(role, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[DELETE /api/admin/roles/${role}/members/${userId}]`, err);
    return NextResponse.json({ error: 'Could not reach identity provider' }, { status: 503 });
  }
}
