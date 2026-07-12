import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Post-login redirect handler for root-domain sign-ins.
 *
 * When a user signs in from saas.techhanker.com (no tenant subdomain), NextAuth
 * can only redirect to the same origin. This page looks up the user's tenant
 * memberships and forwards them to the correct subdomain.
 */
export default async function AuthRedirectPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');

  const dbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { tenant: { select: { slug: true } } },
      },
    },
  });

  const tenants = dbUser?.tenantUsers ?? [];

  if (tenants.length === 0) {
    redirect('/no-workspace');
  }

  // Pick the first (oldest) tenant membership.
  // A multi-tenant picker can be added here later if needed.
  const slug = tenants[0]!.tenant.slug;

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
  const tenantUrl = baseDomain ? `${proto}://${slug}.${baseDomain}/` : `/${slug}`;

  redirect(tenantUrl);
}
