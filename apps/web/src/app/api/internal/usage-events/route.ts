import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import {
  notifyUsageEvents,
  parseUsageEvent,
  USAGE_EVENTS_BATCH_LIMIT,
  type ParsedUsageEvent,
} from '@/lib/usage-events';

export const runtime = 'nodejs';

/**
 * POST /api/internal/usage-events
 *
 * Internal ingestion endpoint for tenant backends (Riogentix) to report
 * usage events. Authenticated with the shared PLATFORM_INTERNAL_SECRET via
 * the `x-internal-secret` header — same secret Traefik injects for the
 * tenant-authz forwardAuth check, so only in-cluster callers can post.
 *
 * Body (single event):
 *   { "tenantId" | "slug": "...", "kind": "flow.executed",
 *     "quantity"?: 1, "occurredAt"?: ISO8601, "metadata"?: {...} }
 *
 * Body (batch):
 *   { "tenantId" | "slug": "...", "events": [ { kind, quantity?, ... }, ... ] }
 *
 * Responses: 201 { inserted }, 400 bad payload, 401 bad secret,
 *            404 unknown tenant.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (!process.env.PLATFORM_INTERNAL_SECRET || secret !== process.env.PLATFORM_INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;

  // Resolve tenant by id or slug.
  const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;
  const slug = typeof payload.slug === 'string' ? payload.slug : undefined;
  if (!tenantId && !slug) {
    return NextResponse.json({ error: 'tenantId or slug is required' }, { status: 400 });
  }

  // Collect raw events: single-event form or batch form.
  let rawEvents: unknown[];
  if (payload.events !== undefined) {
    if (!Array.isArray(payload.events)) {
      return NextResponse.json({ error: 'events must be an array' }, { status: 400 });
    }
    rawEvents = payload.events;
    if (rawEvents.length === 0) {
      return NextResponse.json({ error: 'events must not be empty' }, { status: 400 });
    }
    if (rawEvents.length > USAGE_EVENTS_BATCH_LIMIT) {
      return NextResponse.json(
        { error: `events exceeds batch limit of ${String(USAGE_EVENTS_BATCH_LIMIT)}` },
        { status: 400 },
      );
    }
  } else {
    // Single-event form: the body itself is the event (minus tenant keys).
    const event = { ...payload };
    delete event.tenantId;
    delete event.slug;
    rawEvents = [event];
  }

  const parsed: ParsedUsageEvent[] = [];
  const errors: string[] = [];
  for (const [i, raw] of rawEvents.entries()) {
    const result = parseUsageEvent(raw);
    if (result.ok) {
      parsed.push(result.event);
    } else {
      errors.push(`events[${String(i)}]: ${result.error}`);
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const tenant = tenantId
    ? await adminDb.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    : await adminDb.tenant.findUnique({ where: { slug: slug ?? '' }, select: { id: true } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  await adminDb.usageEvent.createMany({
    data: parsed.map((ev) => ({
      tenantId: tenant.id,
      kind: ev.kind,
      quantity: ev.quantity,
      occurredAt: ev.occurredAt,
    })),
  });

  // Realtime fan-out; a failed NOTIFY must not fail ingestion.
  try {
    await notifyUsageEvents(tenant.id, parsed);
  } catch (err) {
    console.error('[usage-events] pg_notify failed', err);
  }

  return NextResponse.json({ inserted: parsed.length }, { status: 201 });
}
