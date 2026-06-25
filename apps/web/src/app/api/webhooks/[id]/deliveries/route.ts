import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/webhooks/[id]/deliveries
 * Returns delivery history for a webhook endpoint (last 50).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { id } = await params;

  // Verify endpoint belongs to tenant
  const endpoint = await adminDb.webhookEndpoint.findFirst({
    where: { id, tenantId: tenantCtx.tenantId },
  });
  if (!endpoint) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  const deliveries = await adminDb.webhookDelivery.findMany({
    where: { endpointId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      eventId: true,
      status: true,
      attempts: true,
      lastError: true,
      nextRetryAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(deliveries);
}
