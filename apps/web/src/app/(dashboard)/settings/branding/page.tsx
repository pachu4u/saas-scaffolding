import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import { BrandingForm } from '../_components/branding-form';

import { getCurrentTenant } from '@/lib/server-tenant';

export const metadata = { title: 'Branding — Settings' };

export default async function BrandingPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const tenant = await adminDb.tenant.findUnique({
    where: { id: tenantCtx.tenantId },
    select: { name: true, slug: true, branding: true, customDomains: true },
  });
  if (!tenant) redirect('/');

  const b = (tenant.branding ?? {}) as Record<string, unknown>;

  // Derive app domain from first custom domain or slug
  const appDomain = tenant.customDomains[0] ?? `${tenant.slug}.riogentix.app`;

  return (
    <BrandingForm
      initialLogoText={(b.logoText as string | undefined) ?? tenant.name}
      initialPrimaryColor={(b.primaryColor as string | undefined) ?? '#4F7BFF'}
      initialAccentColor={(b.accentColor as string | undefined) ?? '#B06CFF'}
      initialBgColor={(b.bgColor as string | undefined) ?? '#F8F6FF'}
      initialEmailFrom={(b.emailFrom as string | undefined) ?? tenant.name}
      initialEmailReply={(b.emailReply as string | undefined) ?? ''}
      initialEmailFooter={(b.emailFooter as string | undefined) ?? ''}
      initialLoginHeadline={(b.loginHeadline as string | undefined) ?? `Welcome to ${tenant.name}`}
      initialLoginSubheading={
        (b.loginSubheading as string | undefined) ?? 'Sign in to your workspace'
      }
      initialLoginTestimonial={(b.loginTestimonial as string | undefined) ?? ''}
      initialSsoButtonLabel={
        (b.loginSsoLabel as string | undefined) ?? `Continue with ${tenant.name} SSO`
      }
      appDomain={appDomain}
    />
  );
}
