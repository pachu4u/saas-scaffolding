import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

import { can, hasEntitlement, type AuthzContext } from './engine';
import type { PermissionCode } from './permissions';

export interface AuthzOptions {
  permission: PermissionCode;
  /** Optional feature key checked against the tenant's plan features */
  entitlement?: string;
  /** Optional ABAC check — called with the resolved context */
  abac?: (ctx: AuthzContext, req: NextRequest) => Promise<boolean>;
}

// RouteCtx carries whatever Next.js passes as the second handler argument —
// for dynamic segments, that's `{ params: Promise<{ id: string }> }`. It's
// merged alongside `authz` so wrapped handlers can still destructure params.
type RouteHandler<RouteCtx extends object = object> = (
  req: NextRequest,
  ctx: { authz: AuthzContext } & RouteCtx,
) => Promise<NextResponse>;

/**
 * Wraps a route handler with tenant + auth + RBAC + ABAC + entitlement checks.
 *
 * @example
 * export const DELETE = withAuthz(
 *   { permission: 'notes:delete', entitlement: 'notes.delete' },
 *   async (req, { authz }) => { ... }
 * );
 *
 * @example with dynamic route params
 * export const PATCH = withAuthz(
 *   { permission: 'users:update' },
 *   async (req, { authz, params }) => {
 *     const { id } = await params;
 *     ...
 *   },
 * );
 */
export function withAuthz<RouteCtx extends object = object>(
  opts: AuthzOptions,
  handler: RouteHandler<RouteCtx>,
) {
  return async function protectedHandler(req: NextRequest, routeCtx: RouteCtx) {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve internal user
    const user = await adminDb.user.findUnique({
      where: { externalId: session.user.id },
      select: { id: true, externalId: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const tenantSlug = req.headers.get('x-tenant-slug');

    if (!tenantSlug) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
    }

    const tenantCtx = await resolveTenant(tenantSlug);
    if (!tenantCtx) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenantId = tenantCtx.tenantId;
    const plan = tenantCtx.plan;

    const authzCtx: AuthzContext = {
      user: { id: user.id, externalId: user.externalId, email: user.email },
      tenantId,
      plan,
    };

    // 1. RBAC check — platform admins bypass tenant-level RBAC entirely.
    // They have no RoleBinding in most tenants (e.g. one they just created via
    // onboarding), but already have unrestricted access to every tenant via
    // the /admin dashboard and adminDb, so this is not a privilege expansion.
    const isPlatformAdmin =
      Array.isArray(session.groups) &&
      session.groups.some((g) => ['platform_super_admin', 'platform_support'].includes(g));

    if (!isPlatformAdmin) {
      const allowed = await can(authzCtx, opts.permission);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Forbidden', required: opts.permission },
          { status: 403 },
        );
      }
    }

    // 2. Entitlement check
    if (opts.entitlement) {
      const entitled = await hasEntitlement(tenantId, opts.entitlement);
      if (!entitled) {
        return NextResponse.json(
          { error: 'Payment Required', feature: opts.entitlement },
          { status: 402 },
        );
      }
    }

    // 3. ABAC check
    if (opts.abac) {
      const abacPassed = await opts.abac(authzCtx, req);
      if (!abacPassed) {
        return NextResponse.json({ error: 'Forbidden (ABAC)' }, { status: 403 });
      }
    }

    return handler(req, { authz: authzCtx, ...routeCtx });
  };
}

/**
 * ABAC policy: resource must belong to the same tenant.
 * Async to match the shape other ABAC policies need (e.g. ones backed by a
 * DB lookup), even though this particular check has no real await.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function sameTenantPolicy(
  ctx: AuthzContext,
  resource: { tenantId: string },
): Promise<boolean> {
  return resource.tenantId === ctx.tenantId;
}
