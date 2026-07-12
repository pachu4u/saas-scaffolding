import { adminDb } from '@platform/db';
import { resolveTenant, type TenantContext } from '@platform/tenant';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * Resolve tenant context for a Route Handler request.
 *
 * Prefers the `x-tenant-slug` header — set by middleware from the request's
 * subdomain, the only source that's correct for a real multi-tenant
 * deployment — and falls back to `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` only when
 * no subdomain is present. Don't set that env var in a real multi-tenant
 * production deployment; it's a local-dev / single-tenant convenience.
 */
export async function getTenantFromRequest(req: NextRequest): Promise<TenantContext | null> {
  const slug = req.headers.get('x-tenant-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG;
  if (!slug) return null;
  return resolveTenant(slug);
}

export interface CurrentTenantResolution {
  tenant: TenantContext | null;
  /** Count of the signed-in user's ACTIVE tenant memberships, across all tenants. */
  membershipCount: number;
}

/**
 * Resolve tenant context for a Server Component (layout/page) request.
 *
 * Server Components never see a `NextRequest`, but headers middleware set on
 * the incoming request (like `x-tenant-slug`) are still readable via
 * `next/headers`. Resolution order:
 *  1. `x-tenant-slug` header — but only if it names a tenant the signed-in
 *     user actually belongs to. Otherwise a session valid across subdomains
 *     could render another tenant's dashboard just by visiting its
 *     subdomain, since the header alone doesn't prove membership.
 *  2. The user's own tenant membership (first ACTIVE `TenantUser` row).
 *  3. `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` (or 'acme') — local dev /
 *     single-tenant deployments only.
 */
export async function getCurrentTenant(externalUserId: string): Promise<CurrentTenantResolution> {
  const [headerSlug, userRecord] = await Promise.all([
    headers().then((h) => h.get('x-tenant-slug')),
    adminDb.user.findUnique({
      where: { externalId: externalUserId },
      select: {
        tenantUsers: {
          where: { status: 'ACTIVE' },
          select: { tenant: { select: { slug: true } } },
        },
      },
    }),
  ]);

  const memberships = userRecord?.tenantUsers ?? [];
  const memberSlugs = new Set(memberships.map((tu) => tu.tenant.slug));

  const slug =
    (headerSlug && memberSlugs.has(headerSlug) ? headerSlug : undefined) ??
    memberships[0]?.tenant.slug ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ??
    'acme';

  const tenant = await resolveTenant(slug);
  return { tenant, membershipCount: memberships.length };
}
