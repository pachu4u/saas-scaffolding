import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant, type TenantContext } from '@platform/tenant';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * Slugs of tenants the given user has an ACTIVE membership in.
 * Shared by every resolver below so a header/cookie-supplied slug can never
 * be trusted without checking it against the signed-in user's real memberships.
 */
async function getActiveMemberships(
  externalUserId: string,
): Promise<{ tenant: { slug: string } }[]> {
  const userRecord = await adminDb.user.findUnique({
    where: { externalId: externalUserId },
    select: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        select: { tenant: { select: { slug: true } } },
      },
    },
  });
  return userRecord?.tenantUsers ?? [];
}

/**
 * Resolve tenant context for a Route Handler request.
 *
 * Requires a signed-in session and only trusts the `x-tenant-slug` header
 * (or `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` fallback for local-dev /
 * single-tenant deployments) if it names a tenant the signed-in user
 * actually has an ACTIVE membership in — otherwise a session valid across
 * subdomains could read/act on another tenant's data just by sending a
 * different header, since the header alone doesn't prove membership.
 */
export async function getTenantFromRequest(req: NextRequest): Promise<TenantContext | null> {
  const session = await auth();
  const externalUserId = session?.user?.id;
  if (!externalUserId) return null;

  const slug = req.headers.get('x-tenant-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG;
  if (!slug) return null;

  const memberships = await getActiveMemberships(externalUserId);
  if (!memberships.some((tu) => tu.tenant.slug === slug)) return null;

  const tenant = await resolveTenant(slug);
  if (tenant?.status === 'SUSPENDED') return null;
  return tenant;
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
  const [headerSlug, memberships] = await Promise.all([
    headers().then((h) => h.get('x-tenant-slug')),
    getActiveMemberships(externalUserId),
  ]);

  const memberSlugs = new Set(memberships.map((tu) => tu.tenant.slug));

  const slug =
    (headerSlug && memberSlugs.has(headerSlug) ? headerSlug : undefined) ??
    memberships[0]?.tenant.slug ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ??
    'acme';

  const tenant = await resolveTenant(slug);
  return { tenant, membershipCount: memberships.length };
}
