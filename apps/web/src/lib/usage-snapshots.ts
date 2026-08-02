import { adminDb } from '@platform/db';

/**
 * Authoritative per-tenant usage gauges pushed periodically by tenant
 * backends (Riogentix). Unlike the append-only `usage_events` log (which
 * undercounts permanently when fire-and-forget events are dropped), these
 * snapshots are absolute values — each upsert overwrites the previous row,
 * so the table self-heals back to the real usage on every sync.
 *
 * The kind keys are a fixed allowlist matching the counters Riogentix
 * computes in `services/usage_counter.py`.
 */
export const USAGE_SNAPSHOT_KINDS = ['flows', 'storage_bytes', 'api_keys', 'seats'] as const;

export type UsageSnapshotKind = (typeof USAGE_SNAPSHOT_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(USAGE_SNAPSHOT_KINDS);

export function isUsageSnapshotKind(kind: string): kind is UsageSnapshotKind {
  return KIND_SET.has(kind);
}

/** Largest absolute gauge value accepted (matches usage-events quantity cap style). */
const MAX_SNAPSHOT_VALUE = 2_147_483_647; // int4 upper bound

export interface ParsedUsageSnapshot {
  kind: UsageSnapshotKind;
  value: number;
}

/**
 * Validate the `snapshot` object from the ingestion request body.
 * Returns the parsed entries, or an error string describing the problem.
 * Unknown kinds and malformed values are rejected outright so a buggy
 * producer fails loudly rather than silently writing partial state.
 */
export function parseUsageSnapshot(
  raw: unknown,
): { ok: true; entries: ParsedUsageSnapshot[] } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'snapshot must be an object' };
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return { ok: false, error: 'snapshot must not be empty' };
  }

  const entries: ParsedUsageSnapshot[] = [];
  for (const key of keys) {
    if (!isUsageSnapshotKind(key)) {
      return { ok: false, error: `unknown kind: ${key}` };
    }
    const value = obj[key];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_SNAPSHOT_VALUE
    ) {
      return {
        ok: false,
        error: `snapshot.${key} must be an integer between 0 and ${String(MAX_SNAPSHOT_VALUE)}`,
      };
    }
    entries.push({ kind: key, value });
  }
  return { ok: true, entries };
}

/**
 * Upsert each snapshot entry keyed on (tenantId, kind): absolute overwrite,
 * never an append/increment. `recordedAt` is stamped to now on every write.
 */
export async function upsertUsageSnapshots(
  tenantId: string,
  entries: ParsedUsageSnapshot[],
): Promise<number> {
  for (const entry of entries) {
    await adminDb.usageSnapshot.upsert({
      where: { tenantId_kind: { tenantId, kind: entry.kind } },
      create: { tenantId, kind: entry.kind, value: entry.value },
      update: { value: entry.value, recordedAt: new Date() },
    });
  }
  return entries.length;
}

/**
 * Publish a `usage_events` Postgres NOTIFY for a snapshot sync so connected
 * SSE clients (admin dashboard) see the reconciliation activity alongside
 * regular usage events. Same channel/payload conventions as
 * `notifyUsageEvents` in lib/usage-events.ts; failures must not fail the
 * ingestion (callers wrap in try/catch).
 */
export async function notifyUsageSnapshot(
  tenantId: string,
  entries: ParsedUsageSnapshot[],
): Promise<void> {
  if (entries.length === 0) return;

  const totals: Record<string, number> = {};
  for (const entry of entries) {
    totals[entry.kind] = entry.value;
  }

  const payload = JSON.stringify({
    tenantId,
    at: new Date().toISOString(),
    snapshot: true,
    totals,
  });

  // $executeRaw because pg_notify returns void; payload is a bound parameter.
  await adminDb.$executeRaw`SELECT pg_notify('usage_events', ${payload})`;
}
