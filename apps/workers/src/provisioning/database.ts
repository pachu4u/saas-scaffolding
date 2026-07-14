import { Client } from 'pg';

/**
 * Per-tenant database + role on the shared Postgres server (e.g. STACKIT
 * PostgreSQL Flex). One database per tenant is the isolation boundary: a bug
 * in one instance's queries cannot read another tenant's data.
 */

// Tenant slugs are validated at signup, but they become SQL identifiers here —
// enforce the character set again so quoting can never be subverted.
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

export function tenantDbRole(slug: string): string {
  assertValidSlug(slug);
  return `rg_${slug.replaceAll('-', '_')}`;
}

/**
 * Connection URL the tenant pod uses. Host defaults to the admin URL's
 * host:port; override with `hostForPods` when pods reach Postgres through a
 * different address (private network name, service endpoint, …).
 */
export function tenantDatabaseUrl(
  adminUrl: string,
  slug: string,
  password: string,
  hostForPods?: string,
): string {
  const admin = new URL(adminUrl);
  const hostPort = hostForPods ?? admin.host;
  const params = admin.search; // keep sslmode etc. from the admin URL
  return `postgresql://${encodeURIComponent(tenantDbRole(slug))}:${encodeURIComponent(password)}@${hostPort}/${tenantDbName(slug)}${params}`;
}

/**
 * Idempotently create the tenant's role + database and converge the role
 * password. Safe to re-run: existing role gets ALTER'd, existing database is
 * left alone.
 */
export async function ensureTenantDatabase(
  adminUrl: string,
  slug: string,
  password: string,
): Promise<void> {
  const role = tenantDbRole(slug);
  const db = tenantDbName(slug);
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const roleExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    // Identifiers can't be bound as parameters; slug validation above pins the
    // character set, and the password is passed as a quoted literal.
    const quotedPassword = password.replaceAll("'", "''");
    if (roleExists.rowCount === 0) {
      await client.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${quotedPassword}'`);
    } else {
      await client.query(`ALTER ROLE "${role}" LOGIN PASSWORD '${quotedPassword}'`);
    }

    const dbExists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (dbExists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${db}" OWNER "${role}"`);
    }
  } finally {
    await client.end();
  }
}
