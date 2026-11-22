import { Client } from 'pg';

/**
 * Capacity guard for new tenant stacks. Every tenant is one pod on a single
 * VM plus its own connections on one shared Postgres server, so past a
 * point a new tenant degrades everyone. Existing tenants (re-provisions,
 * upgrades) are never blocked.
 */

export interface CapacitySnapshot {
  tenantNamespaces: number;
  dbConnections: number;
  dbMaxConnections: number;
}

export interface CapacityLimits {
  maxTenants: number;
  maxDbConnRatio: number;
}

/** Returns a human-readable reason when a NEW tenant must be refused, else null. */
export function capacityRefusal(snap: CapacitySnapshot, limits: CapacityLimits): string | null {
  if (snap.tenantNamespaces >= limits.maxTenants) {
    return `tenant limit reached (${String(snap.tenantNamespaces)}/${String(limits.maxTenants)})`;
  }
  const ratio = snap.dbConnections / snap.dbMaxConnections;
  if (ratio >= limits.maxDbConnRatio) {
    return `database connections at ${String(Math.round(ratio * 100))}% (${String(snap.dbConnections)}/${String(snap.dbMaxConnections)})`;
  }
  return null;
}

export async function readDbConnections(adminUrl: string): Promise<{ used: number; max: number }> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const res = await client.query<{ used: string; max: string }>(
      `SELECT (SELECT count(*) FROM pg_stat_activity)::text AS used,
              current_setting('max_connections') AS max`,
    );
    const row = res.rows[0];
    return { used: Number(row?.used ?? 0), max: Number(row?.max ?? 100) };
  } finally {
    await client.end();
  }
}
