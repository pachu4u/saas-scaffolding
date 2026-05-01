import { NextResponse } from 'next/server';

import { adminDb } from '@platform/db';

// Temporary unauthenticated endpoint for Phase 4 smoke test.
// Locked down to platform_super_admin in Phase 7.
export async function GET() {
  const tenants = await adminDb.tenant.findMany({
    select: { id: true, slug: true, name: true, status: true, plan: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(tenants);
}
