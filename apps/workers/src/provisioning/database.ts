import { Client } from 'pg';

/**
 * Per-tenant database on the shared Postgres server (e.g. STACKIT
 * PostgreSQL Flex). One database per tenant is the isolation boundary: a bug
 * in one instance's queries cannot read another tenant's data.
 *
 * Originally also created a dedicated Postgres ROLE (unique login/password)
 * per tenant, on top of the per-tenant database -- STACKIT's managed
 * Postgres Flex doesn't grant the app's own DB user CREATEROLE (same
 * constraint the platform schema's own migrations hit, see
 * infra/terraform/stackit/scripts/migrate-stackit.sh), so that always 42501s
 * there. This code path had never actually run end-to-end before a real
 * kubernetes-driver tenant provision surfaced it, 2026-08-23. Simplified:
 * every tenant database is now owned by the platform's own shared DB user
 * (the same one `TENANT_PG_ADMIN_URL` already authenticates as) instead of
 * a per-tenant role -- isolation stays at the database level (separate
 * database per tenant), just not a separate login per tenant.
 */

// Tenant slugs are validated at signup, but they become a SQL identifier
// here — enforce the character set again so quoting can never be subverted.
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

export function assertValidSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Tenant slug ${JSON.stringify(slug)} is not a valid identifier`);
  }
}

export function tenantDbName(slug: string): string {
  assertValidSlug(slug);
  return `riogentix_${slug.replaceAll('-', '_')}`;
}

/**
 * Connection URL the tenant pod uses — the platform's own shared DB
 * credential (parsed from `adminUrl`), pointed at the tenant's own
 * database. Host defaults to the admin URL's host:port; override with
 * `hostForPods` when pods reach Postgres through a different address
 * (private network name, service endpoint, …).
 */
export function tenantDatabaseUrl(adminUrl: string, slug: string, hostForPods?: string): string {
  const admin = new URL(adminUrl);
  const hostPort = hostForPods ?? admin.host;
  const params = admin.search; // keep sslmode etc. from the admin URL
  return `postgresql://${admin.username}:${admin.password}@${hostPort}/${tenantDbName(slug)}${params}`;
}

/**
 * Idempotently create the tenant's database, owned by whichever user
 * `adminUrl` connects as. Safe to re-run: an existing database is left
 * alone.
 */
export async function ensureTenantDatabase(adminUrl: string, slug: string): Promise<void> {
  const db = tenantDbName(slug);
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const dbExists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (dbExists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${db}"`);
    }
  } finally {
    await client.end();
  }
}
