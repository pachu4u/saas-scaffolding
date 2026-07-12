import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

// All dashboard routes depend on the session and live tenant data — never
// pre-render them at build time.  This cascades to every child segment.
export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { getCurrentTenant } from '@/lib/server-tenant';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  // Platform admins don't belong in the tenant dashboard — send them to /admin
  if (isPlatformAdmin) redirect('/admin');

  const { tenant, membershipCount } = await getCurrentTenant(session.user.id);

  // Enforce suspension before rendering any dashboard page.
  if (tenant?.status === 'SUSPENDED') {
    redirect('/suspended');
  }

  // New user with no tenant membership yet. Tenants are provisioned by
  // platform admins (via /onboarding), not self-serve, so send them to a
  // holding page rather than a "create your workspace" flow.
  if (membershipCount === 0) {
    redirect('/no-workspace');
  }

  const tenantName = tenant?.name ?? 'Workspace';
  const tenantSlug = tenant?.slug ?? 'workspace';
  const userName = session.user.name ?? session.user.email.split('@')[0] ?? 'User';

  return (
    <SidebarProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Sidebar
          tenantName={tenantName}
          tenantSlug={tenantSlug}
          userName={userName}
          userEmail={session.user.email}
        />
        <div className="lg:ml-[var(--sidebar-width)]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
