import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import {
  notifyUsageSnapshot,
  parseUsageSnapshot,
  upsertUsageSnapshots,
} from '@/lib/usage-snapshots';

export const runtime = 'nodejs';

/**
 * POST /api/internal/usage-snapshot
 *
 * Internal ingestion endpoint for tenant backends (Riogentix) to push an
 * ABSOLUTE usage snapshot — the authoritative gauge state computed live
 * from the tenant's own database. Unlike the append-only usage-events log
 * (which permanently undercounts when fire-and-forget events are dropped),
 * each upsert overwrites the previous (tenantId, kind) row, so the table
 * self-heals back to real usage on every sync.
 *
 * Authenticated with the shared PLATFORM_INTERNAL_SECRET via the
 * `x-internal-secret` header — same as /api/internal/usage-events.
 *
 * Body:
 *   { "slug": "<slug>",
 *     "snapshot": { "pipes": 3, "storage_bytes": 12345,
 *                   "api_keys": 2, "seats": 4 } }
 *
 * The snapshot keys are a fixed allowlist: pipes, storage_bytes, api_keys,
 * seats. Unknown keys and non-integer values are rejected with 400.
 *
 * Responses: 201 { upserted }, 400 bad payload, 401 bad secret,
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

  const slug = typeof payload.slug === 'string' ? payload.slug : undefined;
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const parsed = parseUsageSnapshot(payload.snapshot);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'Validation failed', details: [parsed.error] },
      { status: 400 },
    );
  }

  const tenant = await adminDb.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const upserted = await upsertUsageSnapshots(tenant.id, parsed.entries);

  // Realtime fan-out; a failed NOTIFY must not fail ingestion.
  try {
    await notifyUsageSnapshot(tenant.id, parsed.entries);
  } catch (err) {
    console.error('[usage-snapshot] pg_notify failed', err);
  }

  return NextResponse.json({ upserted }, { status: 201 });
}
