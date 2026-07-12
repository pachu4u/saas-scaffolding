import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../../../lib/server-tenant';

export const runtime = 'nodejs';

/**
 * POST /api/settings/compliance/delete-request
 * Records a GDPR-style deletion request for review. Real cryptographic
 * erasure (key destruction, irreversible) is not something to trigger
 * automatically from a single click with no confirmation flow — this
 * records an auditable request that platform admins action manually,
 * matching how deletion requests work at most SaaS vendors in practice.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  await adminDb.auditLog.create({
    data: {
      tenantId: tenantCtx.tenantId,
      actorUserId: session.user.id,
      action: 'compliance.deletion_requested',
      resourceType: 'Tenant',
      resourceId: tenantCtx.tenantId,
    },
  });

  return NextResponse.json({ ok: true });
}
