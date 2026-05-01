import { NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';

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
    (session.groups as string[]).some((g: string) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    );

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
