import { auth } from '@platform/auth';
import { redirect } from 'next/navigation';

import { getCurrentTenant } from '@/lib/server-tenant';
import { buildBrandingStyle } from '@/lib/tenant-branding-style';

export const dynamic = 'force-dynamic';

export default async function TenantShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant, membershipCount } = await getCurrentTenant(session.user.id);

  if (tenant?.status === 'SUSPENDED') redirect('/suspended');
  if (membershipCount === 0) redirect('/no-workspace');

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
