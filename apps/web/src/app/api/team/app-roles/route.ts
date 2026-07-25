import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../../lib/server-tenant';

export const runtime = 'nodejs';

/**
 * GET /api/team/app-roles
 * Returns the roles defined by the tenant's connected app (e.g. Riogentix),
 * if it has one. These are additive, assigned on top of a member's primary
 * tenant role — see /api/team/roles/[id]/members/[userId].
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const instance = await adminDb.connectedAppInstance.findFirst({
    where: { tenantId: tenantCtx.tenantId, status: 'ACTIVE' },
    include: { app: { select: { id: true, name: true } } },
  });
  if (!instance) return NextResponse.json([]);

  const roles = await adminDb.role.findMany({
    where: { appId: instance.appId },
    select: {
      id: true,
      name: true,
      _count: { select: { bindings: { where: { tenantId: tenantCtx.tenantId } } } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      appName: instance.app.name,
      memberCount: r._count.bindings,
    })),
  );
}
