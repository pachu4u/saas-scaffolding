import crypto from 'crypto';

import { auth } from '@platform/auth';
import { adminDb, checkRateLimit, rateLimitHeaders } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../lib/server-tenant';

export const runtime = 'nodejs';

const WEBHOOK_EVENTS = [
  'tenant.updated',
  'tenant.suspended',
  'user.invited',
  'user.joined',
  'user.removed',
  'subscription.created',
  'subscription.updated',
  'subscription.cancelled',
] as const;

/**
 * GET /api/webhooks
 * Returns all webhook endpoints for the current tenant.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const endpoints = await adminDb.webhookEndpoint.findMany({
    where: { tenantId: tenantCtx.tenantId, status: { not: 'DELETED' } },
    include: {
      _count: { select: { deliveries: true } },
      deliveries: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, createdAt: true },
      },
    },
  });

  return NextResponse.json(endpoints);
}

/**
 * POST /api/webhooks
 * Body: { url: string; events: string[] }
 * Creates a new webhook endpoint with a generated secret.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Rate limit: 30 webhook endpoint creates per day per tenant
  const rl = await checkRateLimit({
    prefix: 'webhooks:create',
    id: tenantCtx.tenantId,
    limit: 30,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many webhook endpoints created today' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = (await req.json()) as { url?: string; events?: string[] };

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 422 });
  }

  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'url must be a valid URL' }, { status: 422 });
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: 'At least one event type is required' }, { status: 422 });
  }
  const invalidEvents = body.events.filter(
    (e) => !WEBHOOK_EVENTS.includes(e as (typeof WEBHOOK_EVENTS)[number]),
  );
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Unknown event type(s): ${invalidEvents.join(', ')}` },
      { status: 422 },
    );
  }

  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  const endpoint = await adminDb.webhookEndpoint.create({
    data: {
      tenantId: tenantCtx.tenantId,
      url: body.url,
      secret,
      events: body.events,
      status: 'ACTIVE',
    },
  });

  // Return secret only at creation time
  return NextResponse.json({ ...endpoint, secret }, { status: 201 });
}
