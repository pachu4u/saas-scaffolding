import { redirect } from 'next/navigation';

import { auth } from '@platform/auth';
import { resolveTenant } from '@platform/tenant';

import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

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

  const tenantName = tenant?.name ?? 'Workspace';
  const tenantSlug = tenant?.slug ?? slug;
  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g: string) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar tenantName={tenantName} tenantSlug={tenantSlug} isAdmin={isPlatformAdmin} />
      <div className="ml-60">{children}</div>
    </div>
  );
}
