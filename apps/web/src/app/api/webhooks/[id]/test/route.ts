import crypto from 'crypto';

import { auth } from '@platform/auth';
import { adminDb, withPlatformAdmin, checkRateLimit, rateLimitHeaders } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TEST_PAYLOAD = {
  type: 'test.ping',
  data: {
    message: 'This is a test delivery from your webhook configuration.',
    timestamp: new Date().toISOString(),
  },
};

/**
 * POST /api/webhooks/[id]/test
 *
 * Sends a signed test event to the endpoint URL and records a delivery attempt.
 * Rate-limited to 10 test deliveries per hour per tenant.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Rate limit: 10 test pings per hour per tenant
  const rl = await checkRateLimit({
    prefix: 'webhook:test',
    id: tenantCtx.tenantId,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many test deliveries — try again later' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const { id } = await params;

  const endpoint = await adminDb.webhookEndpoint.findFirst({
    where: { id, tenantId: tenantCtx.tenantId, status: { not: 'DELETED' } },
  });
  if (!endpoint) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  // Build signed payload
  const eventId = `evt_test_${crypto.randomBytes(12).toString('hex')}`;
  const payload = JSON.stringify({ id: eventId, ...TEST_PAYLOAD });
  const signature = crypto.createHmac('sha256', endpoint.secret).update(payload).digest('hex');

  let deliveryStatus: 'SUCCESS' | 'FAILED' = 'FAILED';
  let lastError: string | null = null;
  let responseStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000); // 10s timeout

    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test.ping',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Delivery': eventId,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = res.status;
    deliveryStatus = res.ok ? 'SUCCESS' : 'FAILED';
    if (!res.ok) lastError = `HTTP ${String(res.status)}`;
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Network error';
  }

  // Record the delivery attempt
  const delivery = await withPlatformAdmin(async (tx) => {
    return tx.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventId,
        status: deliveryStatus,
        attempts: 1,
        lastError,
      },
      select: { id: true, status: true, attempts: true, lastError: true, createdAt: true },
    });
  });

  return NextResponse.json(
    {
      ok: deliveryStatus === 'SUCCESS',
      deliveryId: delivery.id,
      status: deliveryStatus,
      httpStatus: responseStatus,
      error: lastError,
      eventId,
    },
    { status: deliveryStatus === 'SUCCESS' ? 200 : 502 },
  );
}
