import { PrismaClient } from '@prisma/client';

import { env } from '@platform/config';

// Prisma client that applies tenant RLS on every transaction.
// Use `adminDb` for platform-admin operations that bypass RLS.

function makePrismaClient(url?: string) {
  return new PrismaClient({
    datasourceUrl: url,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Singleton pattern for Next.js hot reload safety
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adminPrisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? makePrismaClient(env.DATABASE_URL);

export const adminDb =
  globalForPrisma.adminPrisma ??
  makePrismaClient(env.DATABASE_URL_MIGRATOR ?? env.DATABASE_URL);

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
  globalForPrisma.adminPrisma = adminDb;
}

/**
 * Run a callback with RLS scoped to the given tenantId.
 * Every query inside `fn` is automatically filtered to that tenant.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE app`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Run a callback as platform_admin (bypasses RLS).
 * Only use for platform-level operations.
 */
export async function withPlatformAdmin<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return adminDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE platform_admin`;
    return fn(tx as unknown as PrismaClient);
  });
}
