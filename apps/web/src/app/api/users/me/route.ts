import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

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
    groups: session.groups,
  });
}

/**
 * PATCH /api/users/me
 * Body: { displayName?: string; avatarUrl?: string }
 *
 * Updates the current user's profile information.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { displayName?: string; avatarUrl?: string };

  const updates: Record<string, unknown> = {};

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
    updates.name = body.displayName.trim();
  }

  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === '') {
      updates.avatarUrl = null;
    } else if (typeof body.avatarUrl === 'string') {
      // Basic URL validation
      try {
        new URL(body.avatarUrl);
        updates.avatarUrl = body.avatarUrl;
      } catch {
        return NextResponse.json({ error: 'avatarUrl must be a valid URL' }, { status: 422 });
      }
    } else {
      return NextResponse.json({ error: 'avatarUrl must be a string' }, { status: 422 });
    }
  }

  if (Object.keys(updates).length > 0) {
    await adminDb.user.update({
      where: { externalId: session.user.id },
      data: updates,
    });
  }

  return NextResponse.json({
    name: updates.name ?? session.user.name,
    email: session.user.email,
    avatarUrl: updates.avatarUrl ?? session.user.image,
  });
}
