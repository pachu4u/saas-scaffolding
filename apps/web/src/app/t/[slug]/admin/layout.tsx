import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { getCurrentTenant } from '@/lib/server-tenant';
import { buildBrandingStyle } from '@/lib/tenant-branding-style';

export default async function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const isPlatformAdmin =
    Array.isArray(session.groups) &&
    session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));

  // admin.{slug}.techhanker.com is the dedicated tenant-admin host (see URL
  // strategy) — a platform admin landing here explicitly asked for this
  // tenant's admin panel, so show it rather than bouncing them away. Only
  // ambiguous entry points (bare /t/{slug}/admin path, no dedicated host)
  // still redirect a platform admin to the real platform panel.
  const isAdminHost = (await headers()).get('x-tenant-admin-host') === '1';

  // Relative redirect() resolves against whatever host served the request. On
  // {slug}.techhanker.com, the middleware rewrites "/admin" straight back into
  // this tenant's admin tree, so a relative target here loops forever instead
  // of reaching the real platform panel.
  if (isPlatformAdmin && !isAdminHost) redirect(new URL('/admin', process.env.AUTH_URL).toString());

  const { tenant } = await getCurrentTenant(session.user.id);

  const connectedAppInstance = tenant
    ? await adminDb.connectedAppInstance.findFirst({
        where: { tenantId: tenant.tenantId },
        select: { app: { select: { name: true } } },
      })
    : null;

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
          {...(connectedAppInstance && { connectedAppName: connectedAppInstance.app.name })}
        />
        <div className="lg:ml-[var(--sidebar-width)]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
