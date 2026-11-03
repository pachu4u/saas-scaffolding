import { auth } from '@platform/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentTenant } from '@/lib/server-tenant';
import { buildBrandingStyle } from '@/lib/tenant-branding-style';

export const dynamic = 'force-dynamic';

export default async function TenantShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant, membershipCount } = await getCurrentTenant(session.user.id);

  if (tenant?.status === 'SUSPENDED') redirect('/suspended');

  if (membershipCount === 0) {
    // A platform admin has no personal tenant membership by design — they're
    // a platform operator, not a tenant member — so "no workspace" doesn't
    // apply to them. Without this, this check fires before
    // t/[slug]/admin/layout.tsx's own (otherwise-correct) redirect-to-console
    // logic ever gets a chance to run, and a platform admin visiting any
    // tenant subdomain gets told to find a workspace instead of being sent to
    // the real platform console. Mirrors that layout's isPlatformAdmin/
    // isAdminHost handling — see its comments for why isAdminHost matters and
    // why the redirect must be an absolute URL.
    const isPlatformAdmin =
      Array.isArray(session.groups) &&
      session.groups.some((g: string) => ['platform_super_admin', 'platform_support'].includes(g));
    if (!isPlatformAdmin) redirect('/no-workspace');

    const isAdminHost = (await headers()).get('x-tenant-admin-host') === '1';
    if (!isAdminHost) redirect(new URL('/admin', process.env.AUTH_URL).toString());
    // else: on the dedicated admin.{slug} host, fall through and let
    // t/[slug]/admin/layout.tsx render that tenant's admin tree.
  }

  // The tile picker (/t/[slug]) and app launcher (/t/[slug]/app) render
  // directly under this layout, outside the admin tree, so they need their
  // own tenant-branding override — otherwise they stay on the default
  // blue/purple palette from globals.css regardless of what the tenant set.
  const brandingCss = buildBrandingStyle(tenant?.branding);

  return (
    <>
      {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}
      {children}
    </>
  );
}
