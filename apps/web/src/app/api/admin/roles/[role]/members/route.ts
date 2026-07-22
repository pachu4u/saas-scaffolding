import { auth } from '@platform/auth';
import { PLATFORM_ROLE_NAMES } from '@platform/authz';
import { type NextRequest, NextResponse } from 'next/server';

import { addUserToGroup, findUserIdByEmail, listGroupMembers } from '@/lib/keycloak-admin';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

function isPlatformSuperAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) && (session.groups as string[]).includes('platform_super_admin')
  );
}

function isPlatformRole(value: string): value is (typeof PLATFORM_ROLE_NAMES)[number] {
  return (PLATFORM_ROLE_NAMES as readonly string[]).includes(value);
}

/**
 * GET /api/admin/roles/[role]/members
 * Lists the Keycloak users belonging to a platform role's group.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role } = await params;
  if (!isPlatformRole(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 404 });

  try {
    const members = await listGroupMembers(role);
    return NextResponse.json(members);
  } catch (err) {
    console.error(`[GET /api/admin/roles/${role}/members]`, err);
    return NextResponse.json({ error: 'Could not reach identity provider' }, { status: 503 });
  }
}

/**
 * POST /api/admin/roles/[role]/members
 * Body: { email } — grants a platform role by adding the user to its Keycloak
 * group. Restricted to platform_super_admin; platform_support is read-only
 * by design and must not be able to escalate itself or others.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformSuperAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role } = await params;
  if (!isPlatformRole(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  try {
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      return NextResponse.json(
        { error: 'No Keycloak user with that email. They must sign in at least once first.' },
        { status: 404 },
      );
    }
    await addUserToGroup(role, userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error(`[POST /api/admin/roles/${role}/members]`, err);
    return NextResponse.json({ error: 'Could not reach identity provider' }, { status: 503 });
  }
}
