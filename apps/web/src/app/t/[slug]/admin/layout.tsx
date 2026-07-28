import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { getCurrentTenant } from '@/lib/server-tenant';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const group = m?.[1];
  if (!group) return null;
  const int = parseInt(group, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${String(rgb[0])},${String(rgb[1])},${String(rgb[2])},${String(alpha)})`;
}

// Every token below defaults (in globals.css) to a shade of the stock
// blue/purple palette. Anything that's meant to read as "brand-colored" —
// not just the handful of literal --brand-* vars — needs to be re-derived
// here from the tenant's chosen colors, or it stays stuck on the old blue
// no matter what the tenant picks (e.g. borders, chart lines, sidebar glow).
function buildBrandingStyle(branding: unknown): string {
  if (!branding || typeof branding !== 'object') return '';
  const b = branding as Record<string, unknown>;
  const vars: string[] = [];
  const primaryColor = typeof b.primaryColor === 'string' ? b.primaryColor : undefined;
  const accentColor = typeof b.accentColor === 'string' ? b.accentColor : undefined;
  const bgColor = typeof b.bgColor === 'string' ? b.bgColor : undefined;
  if (primaryColor && hexToRgb(primaryColor)) {
    vars.push(`--brand-primary:${primaryColor}`);
    vars.push(`--brand-secondary:${primaryColor}`);
    vars.push(`--sidebar-accent:${primaryColor}`);
    vars.push(`--status-info:${primaryColor}`);
    vars.push(`--chart-line:${primaryColor}`);
    vars.push(`--chart-area:${rgba(primaryColor, 0.1)}`);
    vars.push(`--border-light:${rgba(primaryColor, 0.12)}`);
    vars.push(`--border-default:${rgba(primaryColor, 0.22)}`);
    vars.push(`--sidebar-item-active:${rgba(primaryColor, 0.15)}`);
    vars.push(`--glow-blue:${rgba(primaryColor, 0.25)}`);
    vars.push(`--shadow-brand:0 4px 24px ${rgba(primaryColor, 0.15)}`);
  }
  if (accentColor && hexToRgb(accentColor)) {
    vars.push(`--brand-accent:${accentColor}`);
    vars.push(`--glow-purple:${rgba(accentColor, 0.2)}`);
  }
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
