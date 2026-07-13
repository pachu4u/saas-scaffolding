import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { getCurrentTenant } from '@/lib/server-tenant';

function buildBrandingStyle(branding: unknown): string {
  if (!branding || typeof branding !== 'object') return '';
  const b = branding as Record<string, unknown>;
  const vars: string[] = [];
  const primaryColor = typeof b.primaryColor === 'string' ? b.primaryColor : undefined;
  const accentColor = typeof b.accentColor === 'string' ? b.accentColor : undefined;
  const bgColor = typeof b.bgColor === 'string' ? b.bgColor : undefined;
  if (primaryColor) {
    vars.push(`--brand-primary:${primaryColor}`);
    vars.push(`--brand-secondary:${primaryColor}`);
    vars.push(`--sidebar-accent:${primaryColor}`);
  }
  if (accentColor) vars.push(`--brand-accent:${accentColor}`);
  if (primaryColor && accentColor)
    vars.push(`--brand-gradient:linear-gradient(135deg,${accentColor},${primaryColor})`);
  if (bgColor) vars.push(`--bg-main:${bgColor}`);
  return vars.length ? `:root{${vars.join(';')}}` : '';
}

export default async function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  if (isPlatformAdmin) redirect('/admin');

  const { tenant } = await getCurrentTenant(session.user.id);

  const tenantName = tenant?.name ?? 'Workspace';
  const tenantSlug = tenant?.slug ?? 'workspace';
  const userName = session.user.name ?? session.user.email.split('@')[0] ?? 'User';
  const brandingCss = buildBrandingStyle(tenant?.branding);

  return (
    <SidebarProvider>
      {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}
      <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
        <Sidebar
          tenantName={tenantName}
          tenantSlug={tenantSlug}
          userName={userName}
          userEmail={session.user.email}
          riogentixUrl={process.env.RIOGENTIX_PUBLIC_URL}
        />
        <div className="lg:ml-[var(--sidebar-width)]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
