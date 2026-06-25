import { redirect } from 'next/navigation';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

// All dashboard routes depend on the session and live tenant data — never
// pre-render them at build time.  This cascades to every child segment.
export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g: string) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    );

  // Platform admins don't belong in the tenant dashboard — send them to /admin
  if (isPlatformAdmin) redirect('/admin');

  // Resolve the tenant from the x-tenant-slug header set by middleware.
  // In dev / non-subdomain setups we fall back to 'acme'.
  const slug =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme')
      : 'acme';

  const tenant = await resolveTenant(slug);

  // Enforce suspension before rendering any dashboard page.
  if (tenant?.status === 'SUSPENDED') {
    redirect('/suspended');
  }

  // New user with no workspace membership → onboarding
  const dbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: { _count: { select: { tenantUsers: { where: { status: { not: 'SUSPENDED' } } } } } },
  });
  if (dbUser && dbUser._count.tenantUsers === 0 && !tenant) {
    redirect('/onboarding');
  }

  const tenantName = tenant?.name ?? 'Workspace';
  const tenantSlug = tenant?.slug ?? slug;

  return (
    <SidebarProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Sidebar tenantName={tenantName} tenantSlug={tenantSlug} />
        <div className="lg:ml-[var(--sidebar-width)]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
