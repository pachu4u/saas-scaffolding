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

/**
 * Per-tenant login name. Same identifier as the database: one login per
 * tenant, created through the Postgres Flex API (see stackit-flex.ts), since
 * SQL users there can't CREATE ROLE.
 */
export function tenantDbUser(slug: string): string {
  return tenantDbName(slug);
}

/** Pod connection URL for a tenant's own login. */
export function tenantOwnLoginUrl(
  adminUrl: string,
  slug: string,
  creds: { username: string; password: string },
  hostForPods?: string,
): string {
  const admin = new URL(adminUrl);
  const url = new URL(adminUrl);
  url.username = encodeURIComponent(creds.username);
  url.password = encodeURIComponent(creds.password);
  url.host = hostForPods ?? admin.host;
  url.pathname = `/${tenantDbName(slug)}`;
  return url.toString();
}

/** The login a connection URL authenticates as. */
export function urlUsername(url: string): string {
  return decodeURIComponent(new URL(url).username);
}

/**
 * STACKIT's own Flex login used for metrics; it must keep CONNECT once
 * PUBLIC loses it, or instance monitoring breaks.
 */
const ALWAYS_ALLOWED = ['monitoring'];

/**
 * SQL that makes `db` reachable only by its owner, `login` and STACKIT's
 * monitoring role, and lets `login` create and change objects in `public`.
 * Run while connected to `db` as its owner (the platform's admin login).
 */
export function tenantAccessStatements(db: string, login: string): string[] {
  const q = (ident: string): string => `"${ident.replaceAll('"', '""')}"`;
  return [
    `REVOKE CONNECT, TEMPORARY ON DATABASE ${q(db)} FROM PUBLIC`,
    `GRANT CONNECT, TEMPORARY ON DATABASE ${q(db)} TO ${q(login)}`,
    ...ALWAYS_ALLOWED.map((r) => `GRANT CONNECT ON DATABASE ${q(db)} TO ${q(r)}`),
    `GRANT USAGE, CREATE ON SCHEMA public TO ${q(login)}`,
    // Tables created by the admin login before the tenant had its own login
    // (pre-2026-11 tenants); harmless no-ops for a fresh database.
    `GRANT ALL ON ALL TABLES IN SCHEMA public TO ${q(login)}`,
    `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${q(login)}`,
  ];
}

export async function ensureTenantDbAccess(
  adminUrl: string,
  slug: string,
  login: string,
): Promise<void> {
  assertValidSlug(slug);
  const db = tenantDbName(slug);
  const url = new URL(adminUrl);
  url.pathname = `/${db}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const roles = await client.query<{ rolname: string }>(
      'SELECT rolname FROM pg_roles WHERE rolname = ANY($1)',
      [ALWAYS_ALLOWED],
    );
    const present = new Set(roles.rows.map((r) => r.rolname));
    for (const sql of tenantAccessStatements(db, login)) {
      const missingRole = ALWAYS_ALLOWED.find((r) => !present.has(r) && sql.endsWith(`"${r}"`));
      if (missingRole) continue;
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}
