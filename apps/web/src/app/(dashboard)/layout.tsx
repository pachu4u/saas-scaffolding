import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { redirect } from 'next/navigation';

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
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  // Platform admins don't belong in the tenant dashboard — send them to /admin
  if (isPlatformAdmin) redirect('/admin');

  // NOTE: this does NOT read the per-request x-tenant-slug header (layouts
  // don't have access to it) — it always resolves the same configured
  // default tenant. That's correct for this app's current single-tenant-per-
  // deployment model, but means this layout cannot distinguish tenants by
  // subdomain the way individual API routes (which do read the header) can.
  // See apps/web/src/middleware.ts for how/when that header gets set.
  const slug =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme')
      : 'acme';

  const tenant = await resolveTenant(slug);

  // Enforce suspension before rendering any dashboard page.
  if (tenant?.status === 'SUSPENDED') {
    redirect('/suspended');
  }

  // New user with no tenant membership yet. Tenants are provisioned by
  // platform admins (via /onboarding), not self-serve, so send them to a
  // holding page rather than a "create your workspace" flow.
  const dbUser = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: { _count: { select: { tenantUsers: { where: { status: { not: 'SUSPENDED' } } } } } },
  });
  if (dbUser?._count.tenantUsers === 0 && !tenant) {
    redirect('/no-workspace');
  }

  const tenantName = tenant?.name ?? 'Workspace';
  const tenantSlug = tenant?.slug ?? slug;
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
