import type { PermissionCode } from './permissions';
import { ROLE_PERMISSIONS } from './permissions';
import { adminDb, redis } from '@platform/db';

export interface AuthzUser {
  id: string;
  externalId: string;
  email: string;
}

export interface AuthzContext {
  user: AuthzUser;
  tenantId: string;
  plan: string;
}

interface CachedAuthz {
  roles: string[];
  permissions: PermissionCode[];
}

const CACHE_TTL = 120; // seconds

async function getUserAuthz(ctx: AuthzContext): Promise<CachedAuthz> {
  const cacheKey = `authz:${ctx.tenantId}:${ctx.user.id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as CachedAuthz;
  } catch {
    /* cache miss */
  }

  const bindings = await adminDb.roleBinding.findMany({
    where: {
      OR: [
        { tenantId: ctx.tenantId, userId: ctx.user.id },
        // Platform roles have tenantId null but are scoped via role table
      ],
    },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const roles = bindings.map((b) => b.role.name);
  const permissions = [
    ...new Set(
      bindings.flatMap((b) => b.role.permissions.map((rp) => rp.permission.code as PermissionCode)),
    ),
  ];

  // Fall back to static defaults for system roles
  for (const role of roles) {
    const defaults = ROLE_PERMISSIONS[role];
    if (defaults) {
      for (const p of defaults) {
        if (!permissions.includes(p)) permissions.push(p);
      }
    }
  }

  const result: CachedAuthz = { roles, permissions };
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch {
    /* non-fatal */
  }

  return result;
}

/**
 * Check whether a user has a specific permission within a tenant context.
 */
export async function can(ctx: AuthzContext, permission: PermissionCode): Promise<boolean> {
  const { permissions } = await getUserAuthz(ctx);
  return permissions.includes(permission);
}

/**
 * Check feature entitlement from the plan's features JSON.
 */
export async function hasEntitlement(tenantId: string, feature: string): Promise<boolean> {
  const subscription = await adminDb.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!subscription) return false;

  const features = subscription.plan.features as Record<string, unknown>;
  const keys = feature.split('.');
  let val: unknown = features;
  for (const key of keys) {
    if (typeof val !== 'object' || val === null) return false;
    val = (val as Record<string, unknown>)[key];
  }
  return val !== false && val !== null && val !== undefined;
}

export function invalidateAuthzCache(tenantId: string, userId: string): Promise<number> {
  return redis.del(`authz:${tenantId}:${userId}`);
}
