import { auth } from '@platform/auth';
import { env } from '@platform/config';
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
 * The optional `host` param (currently only `admin`) records which dedicated
 * subdomain the user started sign-in from, so login round-trips back there
 * instead of always landing on the bare tenant root.
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; host?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  // Platform admins have no tenant memberships — send them to the admin console
  // on the root domain instead of falling through to /no-workspace. Mirrors the
  // group check in (admin)/layout.tsx, which guards the destination server-side.
  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));
  if (isPlatformAdmin) redirect('/admin');

  const { tenant: tenantParam, host: hostParam } = await searchParams;

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

  // If the user started sign-in for a specific tenant, land there — but only
  // if they're actually a member of that tenant (security check). The tenant
  // subdomain root now serves the tile page directly (middleware rewrites
  // {slug}.techhanker.com/ to the /t/{slug} tree at the edge of this app), so
  // send the browser there instead of to the root-domain /t/{slug} path.
  const slugs = tenants.map((t) => t.tenant.slug);
  const targetSlug = tenantParam && slugs.includes(tenantParam) ? tenantParam : (slugs[0] ?? null);

  if (!targetSlug) redirect('/no-workspace');

  // Only 'admin' is a recognized value — anything else falls back to the bare
  // tenant subdomain rather than trusting an arbitrary host label from the URL.
  const subdomain = hostParam === 'admin' ? `admin.${targetSlug}` : targetSlug;
  redirect(env.AUTH_URL.replace('saas.', `${subdomain}.`));
}
