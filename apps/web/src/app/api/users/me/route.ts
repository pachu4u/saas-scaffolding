import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';

export const runtime = 'nodejs';

/**
 * GET /api/users/me
 * Returns the current user's DB record + tenant memberships.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    include: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        include: {
          tenant: { select: { id: true, name: true, slug: true, plan: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Merge DB record with session claims
  return NextResponse.json({
    id: user.id,
    externalId: user.externalId,
    email: user.email,
    name: session.user.name,
    status: user.status,
    createdAt: user.createdAt,
    workspaces: user.tenantUsers.map((tu) => ({
      tenantId: tu.tenantId,
      tenantName: tu.tenant.name,
      tenantSlug: tu.tenant.slug,
      plan: tu.tenant.plan,
      status: tu.status,
    })),
    groups: session.groups ?? [],
  });
}

/**
 * PATCH /api/users/me
 * Body: { displayName?: string }
 *
 * Currently: displayName is read from the Keycloak JWT and cannot be
 * persisted in the platform DB (no column). This route validates the
 * request and returns the session data; a future migration can add a
 * `display_name` column to `users` to make it sticky.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { displayName?: string };

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
      return NextResponse.json(
        { error: 'displayName must be a non-empty string' },
        { status: 422 },
      );
    }
    if (body.displayName.trim().length > 128) {
      return NextResponse.json(
        { error: 'displayName must be 128 characters or fewer' },
        { status: 422 },
      );
    }
  }

  // TODO: once users.display_name column is added, persist here:
  // await adminDb.user.update({
  //   where: { externalId: session.user.id },
  //   data: { displayName: body.displayName?.trim() },
  // });

  return NextResponse.json({
    name: body.displayName?.trim() ?? session.user.name,
    email: session.user.email,
    _note: 'displayName changes take effect after next Keycloak token refresh',
  });
}
