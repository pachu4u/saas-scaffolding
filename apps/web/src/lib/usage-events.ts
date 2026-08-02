import { adminDb } from '@platform/db';

/**
 * Canonical usage-event kinds emitted by tenant backends (Riogentix) and
 * accepted by the ingestion endpoint. Kept as a plain array + Set so adding
 * a new kind is a one-line change.
 */
export const USAGE_EVENT_KINDS = [
  'flow.created',
  'flow.deleted',
  'flow.executed',
  'storage.updated',
  'apikey.created',
  'seat.added',
] as const;

export type UsageEventKind = (typeof USAGE_EVENT_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(USAGE_EVENT_KINDS);

export function isUsageEventKind(kind: string): kind is UsageEventKind {
  return KIND_SET.has(kind);
}

/** Max events accepted in a single batch POST. */
export const USAGE_EVENTS_BATCH_LIMIT = 500;

/** Postgres NOTIFY payloads are hard-capped at 8000 bytes; stay well under. */
const NOTIFY_PAYLOAD_BUDGET = 8000;

export interface ParsedUsageEvent {
  kind: string;
  quantity: number;
  occurredAt: Date;
  /**
   * Accepted from the ingestion payload for forward compatibility, but NOT
   * persisted — the usage_events table has no metadata column yet. When one
   * is added, start writing it in the ingestion route.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Validate one raw event object from the ingestion request body.
 * Returns a parsed event, or an error string describing the problem.
 */
export function parseUsageEvent(
  raw: unknown,
): { ok: true; event: ParsedUsageEvent } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'event must be an object' };
  }
  const obj = raw as Record<string, unknown>;

  const kind = obj.kind;
  if (typeof kind !== 'string' || kind.length === 0) {
    return { ok: false, error: 'kind is required' };
  }
  if (!isUsageEventKind(kind)) {
    return { ok: false, error: `unknown kind: ${kind}` };
  }

  let quantity = 1;
  if (obj.quantity !== undefined) {
    if (
      typeof obj.quantity !== 'number' ||
      !Number.isInteger(obj.quantity) ||
      obj.quantity < 1 ||
      obj.quantity > 1_000_000
    ) {
      return { ok: false, error: 'quantity must be an integer between 1 and 1000000' };
    }
    quantity = obj.quantity;
  }

  let occurredAt = new Date();
  if (obj.occurredAt !== undefined) {
    if (typeof obj.occurredAt !== 'string') {
      return { ok: false, error: 'occurredAt must be an ISO 8601 string' };
    }
    const parsed = new Date(obj.occurredAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'occurredAt is not a valid date' };
    }
    occurredAt = parsed;
  }

  let metadata: Record<string, unknown> | undefined;
  if (obj.metadata !== undefined) {
    if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
      return { ok: false, error: 'metadata must be an object' };
    }
    metadata = obj.metadata as Record<string, unknown>;
  }

  return { ok: true, event: { kind, quantity, occurredAt, ...(metadata ? { metadata } : {}) } };
}

export interface NotifySummaryItem {
  kind: string;
  quantity: number;
  occurredAt: string;
}

/**
 * Publish a `usage_events` Postgres NOTIFY for freshly-ingested events so
 * connected SSE clients (admin dashboard) can update in realtime.
 *
 * The payload is a compact JSON document: tenant id + a per-kind summary of
 * the batch (individual events when the batch is small). If serializing the
 * full summary would exceed the Postgres 8000-byte payload limit, we fall
 * back to an aggregate-only payload — clients treat the notification as a
 * "new data exists" hint either way.
 */
export async function notifyUsageEvents(
  tenantId: string,
  events: ParsedUsageEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const totals: Record<string, number> = {};
  for (const ev of events) {
    totals[ev.kind] = (totals[ev.kind] ?? 0) + ev.quantity;
  }

  const base = {
    tenantId,
    at: new Date().toISOString(),
    totals,
  };

  const withEvents = {
    ...base,
    events: events.map(
      (ev): NotifySummaryItem => ({
        kind: ev.kind,
        quantity: ev.quantity,
        occurredAt: ev.occurredAt.toISOString(),
      }),
    ),
  };

  let payload = JSON.stringify(withEvents);
  if (payload.length >= NOTIFY_PAYLOAD_BUDGET) {
    payload = JSON.stringify(base);
  }

  // $executeRaw is used because pg_notify returns void; $queryRaw would fail
  // to deserialize a void column. Payload is passed as a bound parameter,
  // never interpolated into SQL.
  await adminDb.$executeRaw`SELECT pg_notify('usage_events', ${payload})`;
}
