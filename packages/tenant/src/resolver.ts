import type { TenantContext } from './context';
import { adminDb, redis } from '@platform/db';

const CACHE_TTL_SECONDS = 60;
const RESERVED_SUBDOMAINS = new Set([
  'auth',
  'api',
  'admin',
  'app',
  'www',
  '_health',
  'traefik',
  'grafana',
  'mail',
  'pgadmin',
]);

/**
 * Extract the leftmost DNS label from a Host header.
 * Returns null for reserved subdomains.
 */
export function extractSlug(host: string): string | null {
  const label = host.split('.')[0]?.toLowerCase();
  if (!label || RESERVED_SUBDOMAINS.has(label)) return null;
  // Slugs: alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(label)) return null;
  return label;
}

/**
 * Resolve a tenant slug to its context record.
 * Results are cached in Redis for CACHE_TTL_SECONDS.
 */
export async function resolveTenant(slug: string): Promise<TenantContext | null> {
  const cacheKey = `tenant:slug:${slug}`;

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TenantContext;
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  const tenant = await adminDb.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      status: true,
      branding: true,
    },
  });

  if (!tenant || tenant.status === 'DELETED') return null;

  const ctx: TenantContext = {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    branding: tenant.branding as Record<string, unknown>,
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(ctx));
  } catch {
    // Redis write failure is non-fatal
  }

  return ctx;
}

export function invalidateTenantCache(slug: string): Promise<number> {
  return redis.del(`tenant:slug:${slug}`);
}
