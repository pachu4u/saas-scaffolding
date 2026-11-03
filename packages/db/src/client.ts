import { env } from '@platform/config';
import { PrismaClient } from '@prisma/client';

// Prisma client that applies tenant RLS on every transaction.
// Use `adminDb` for platform-admin operations that bypass RLS.

// The managed Postgres instance (STACKIT PostgresFlex, reached over the
// network rather than a local container) intermittently closes a pooled
// connection out from under Prisma -- logs show repeated
// `Error in PostgreSQL connection: Error { kind: Closed, cause: None }`.
// Without explicit bounds, recovering from that (detecting the dead
// connection, waiting for the pool, opening a fresh one) has been observed
// taking 30-120+ seconds on a single request instead of failing fast, which
// is indistinguishable from a hang to anyone hitting the app. Pin
// `connect_timeout` (seconds to establish a new TCP/TLS connection) and
// `pool_timeout` (seconds to wait for a pooled connection before erroring)
// explicitly rather than relying on Prisma's defaults, so a bad connection
// surfaces as a quick, retriable error instead of a multi-minute stall.
function withConnectionTimeouts(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has('connect_timeout')) parsed.searchParams.set('connect_timeout', '10');
  if (!parsed.searchParams.has('pool_timeout')) parsed.searchParams.set('pool_timeout', '10');
  return parsed.toString();
}

function makePrismaClient(url?: string) {
  return new PrismaClient({
    ...(url !== undefined ? { datasourceUrl: withConnectionTimeouts(url) } : {}),
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// adminDb is documented as bypassing RLS unconditionally -- true when this
// bypassed RLS via `SET LOCAL ROLE platform_admin` (a Postgres role with
// BYPASSRLS), which applied to every query on the connection with no
// per-call wrapping needed. Migration 20260821000000_rls_bypass_via_guc_not_role
// switched to a session GUC (app.bypass_rls) instead -- STACKIT's managed
// Postgres Flex doesn't grant CREATEROLE, so the role-based approach
// couldn't create platform_admin there -- but only withPlatformAdmin()
// actually sets that GUC, in its own transaction. Every OTHER adminDb call
// across the app (there are dozens) was written against the old
// always-bypasses semantics and was never updated, so on STACKIT
// specifically they silently RLS-filtered to empty results with no error --
// found the hard way: a real, verified-correct tenant_users/role_bindings
// row existed, but auth/redirect's `adminDb.user.findUnique({..., select:
// { tenantUsers: {...} } })` still came back with `tenantUsers: []`, so a
// legitimate tenant admin got told "no workspace yet" on first login.
//
// Fixed at the connection level instead of hunting down every call site:
// Postgres accepts arbitrary GUCs via the `options` connection-string
// parameter (`-c app.bypass_rls=true`), applied at connection
// establishment by the server itself -- so every connection in adminDb's
// pool has bypass_rls on by default, restoring the original "adminDb just
// bypasses RLS, full stop" behavior without touching call sites.
// withPlatformAdmin() is now redundant but harmless to keep calling.
function withBypassRlsOption(url: string): string {
  const parsed = new URL(url);
  const existing = parsed.searchParams.get('options') ?? '';
  const bypassOption = '-c app.bypass_rls=true';
  parsed.searchParams.set('options', existing ? `${existing} ${bypassOption}` : bypassOption);
  return parsed.toString();
}

// Singleton pattern for Next.js hot reload safety
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adminPrisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? makePrismaClient(env.DATABASE_URL);

export const adminDb =
  globalForPrisma.adminPrisma ??
  makePrismaClient(withBypassRlsOption(env.DATABASE_URL_MIGRATOR ?? env.DATABASE_URL));

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
  globalForPrisma.adminPrisma = adminDb;
}

/**
 * Run a callback with RLS scoped to the given tenantId.
 * Every query inside `fn` is automatically filtered to that tenant.
 *
 * Bypass/scope is enforced via the app.bypass_rls / app.tenant_id session
 * GUCs the RLS policies check directly (see migration
 * 20260821000000_rls_bypass_via_guc_not_role), not via SET LOCAL ROLE --
 * that required a Postgres superuser (works for the container-hosted
 * `postgres` user local dev/techhanker.com connect as) or CREATEROLE on the
 * app's own DB user to create the app/migrator/platform_admin roles, neither
 * of which STACKIT's managed Postgres Flex grants.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Run a callback as platform admin (bypasses RLS).
 * Only use for platform-level operations.
 */
export async function withPlatformAdmin<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return adminDb.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'true', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}
