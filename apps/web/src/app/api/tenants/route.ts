import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tenants
 *
 * Returns all tenants. Restricted to platform-admin sessions only.
 * Any request without a valid platform-admin session receives 401.
 */
export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for platform:admin permission via the user's groups/roles.
  // The Keycloak token includes a "groups" claim; platform admins belong
  // to the "platform_super_admin" group which maps to the platform:admin permission.
  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenants = await adminDb.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(tenants);
}

/**
 * POST /api/tenants
 *
 * Creates a new tenant. Restricted to platform-admin sessions only.
 */
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; slug?: string; plan?: string };
  const { name, slug, plan = 'free' } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug may only contain lowercase letters, numbers, and hyphens' },
      { status: 400 },
    );
  }

  try {
    const tenant = await withPlatformAdmin(async (tx) => {
      return tx.tenant.create({
        data: {
          name: name.trim(),
          slug: slug.trim(),
          plan,
          status: 'ACTIVE',
        },
        select: { id: true, slug: true, name: true, status: true, plan: true, createdAt: true },
      });
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A tenant with that slug already exists' },
        { status: 409 },
      );
    }
    console.error('[POST /api/tenants]', err);
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}
