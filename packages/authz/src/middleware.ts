import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

import { can, hasEntitlement, type AuthzContext } from './engine';
import type { PermissionCode } from './permissions';

export interface AuthzOptions {
  permission: PermissionCode;
  /** Optional feature key checked against the tenant's plan features */
  entitlement?: string;
  /** Optional ABAC check — called with the resolved context */
  abac?: (ctx: AuthzContext, req: NextRequest) => Promise<boolean>;
}

type RouteHandler = (req: NextRequest, ctx: { authz: AuthzContext }) => Promise<NextResponse>;

/**
 * Wraps a route handler with tenant + auth + RBAC + ABAC + entitlement checks.
 *
 * @example
 * export const DELETE = withAuthz(
 *   { permission: 'notes:delete', entitlement: 'notes.delete' },
 *   async (req, { authz }) => { ... }
 * );
 */
export function withAuthz(opts: AuthzOptions, handler: RouteHandler) {
  return async function protectedHandler(req: NextRequest) {
    const tenantSlug = req.headers.get('x-tenant-slug');

    if (!tenantSlug) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 404 });
    }

    const tenantCtx = await resolveTenant(tenantSlug);
    if (!tenantCtx) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenantId = tenantCtx.tenantId;
    const plan = tenantCtx.plan ?? 'free';

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

    const authzCtx: AuthzContext = {
      user: { id: user.id, externalId: user.externalId, email: user.email },
      tenantId,
      plan,
    };

    // 1. RBAC check
    const allowed = await can(authzCtx, opts.permission);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden', required: opts.permission },
        { status: 403 },
      );
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

    return handler(req, { authz: authzCtx });
  };
}

/** ABAC policy: resource must belong to the same tenant */
export async function sameTenantPolicy(
  ctx: AuthzContext,
  resource: { tenantId: string },
): Promise<boolean> {
  return resource.tenantId === ctx.tenantId;
}
