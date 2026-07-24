import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import {
  createPendingKeycloakUser,
  deleteKeycloakUser,
  findUserIdByEmail,
  sendKeycloakSetPasswordEmail,
} from '@/lib/keycloak-admin';

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
 * GET /api/admin/users
 * Query params: ?q=search&limit=50&offset=0
 * Cross-tenant user search with last activity.
 * Requires platform-admin session.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const offset = Number(searchParams.get('offset') ?? '0');

  const where = q ? { email: { contains: q, mode: 'insensitive' as const } } : {};

  const [users, total] = await Promise.all([
    adminDb.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        externalId: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenantUsers: {
          select: {
            status: true,
            tenant: { select: { id: true, name: true, slug: true, plan: true } },
          },
        },
        auditLogs: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true, action: true },
        },
      },
    }),
    adminDb.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      lastActivity: u.auditLogs[0]
        ? { action: u.auditLogs[0].action, occurredAt: u.auditLogs[0].occurredAt }
        : null,
    })),
    total,
    limit,
    offset,
  });
}

/**
 * POST /api/admin/users
 * Body: { email: string; name?: string }
 *
 * Creates a bare platform-level account: a Keycloak identity plus a `users`
 * row, with no TenantUser and no RoleBinding. This is the only way to add a
 * user to the app without also putting them in a workspace or granting a
 * tenant-scoped role — every other entry point (signup, team invite) creates
 * both as one step. Requires platform-admin session.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  const trimmedName = body.name?.trim();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '' should become undefined too
  const name = trimmedName ? trimmedName : undefined;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 422 });
  }

  const existing = await adminDb.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }

  // Reuse an existing Keycloak identity if one already exists for this email
  // (e.g. left over from a deleted tenant); only create — and only roll back
  // — when we're the ones creating it.
  let kcUserId = await findUserIdByEmail(email).catch(() => null);
  const createdKcUser = !kcUserId;
  kcUserId ??= await createPendingKeycloakUser(email, name);

  try {
    const user = await adminDb.user.create({
      data: { email, externalId: kcUserId, name: name ?? null },
      select: {
        id: true,
        externalId: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    if (createdKcUser) {
      await sendKeycloakSetPasswordEmail(kcUserId).catch((err: unknown) => {
        console.warn('[POST /api/admin/users] execute-actions-email failed (non-fatal):', err);
      });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (createdKcUser) await deleteKeycloakUser(kcUserId);
    console.error('[POST /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * Body: { userId: string; action: 'suspend' | 'reinstate' }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as { userId?: string; action?: string };
  const { userId, action } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action are required' }, { status: 422 });
  }

  const user = await adminDb.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (action === 'suspend') {
    await adminDb.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    return NextResponse.json({ ok: true, status: 'SUSPENDED' });
  }

  if (action === 'reinstate') {
    await adminDb.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    return NextResponse.json({ ok: true, status: 'ACTIVE' });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
