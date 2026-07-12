import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../../lib/server-tenant';

export const runtime = 'nodejs';

/**
 * GET /api/settings/api-keys-list
 * Returns the list of SCIM/API tokens for the current tenant (no raw token values).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const tokens = await adminDb.scimToken.findMany({
    where: { tenantId: tenantCtx.tenantId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, scopes: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json(tokens);
}
