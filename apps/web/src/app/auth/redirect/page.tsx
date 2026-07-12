import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Post-login redirect handler.
 *
 * NextAuth's callback always lands on saas.techhanker.com. This page reads the
 * optional `tenant` query param (set by the signin page when the user started on a
 * subdomain) and redirects them to the right workspace. Falls back to their first
 * active tenant if the param is absent or the user isn't a member of that tenant.
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  const { tenant: tenantParam } = await searchParams;

  const dbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        orderBy: { joinedAt: 'asc' },
        select: { tenant: { select: { slug: true } } },
      },
    },
  });

  const tenants = dbUser?.tenantUsers ?? [];

  if (tenants.length === 0) {
    redirect('/no-workspace');
  }

  // Derive the base domain from AUTH_URL (e.g. "saas.techhanker.com" → "techhanker.com").
  const authHost = process.env.AUTH_URL
    ? (() => {
        try {
          return new URL(process.env.AUTH_URL).hostname;
        } catch {
          return '';
        }
      })()
    : '';
  const baseDomain = authHost.split('.').slice(1).join('.');
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  // If the user started on a specific tenant subdomain, go back there — but only
  // if they're actually a member of that tenant (security check).
  const slugs = tenants.map((t) => t.tenant.slug);
  const targetSlug = tenantParam && slugs.includes(tenantParam) ? tenantParam : (slugs[0] ?? null);

  if (!targetSlug) redirect('/no-workspace');

  const tenantUrl = baseDomain ? `${proto}://${targetSlug}.${baseDomain}/` : `/${targetSlug}`;
  redirect(tenantUrl);
}
