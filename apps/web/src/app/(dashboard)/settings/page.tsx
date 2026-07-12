import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { redirect } from 'next/navigation';

import SettingsForm from './_components/settings-form';

import { getCurrentTenant } from '@/lib/server-tenant';

export const metadata = { title: 'Settings — General' };

export default async function SettingsGeneralPage() {
  const session = await auth();
  if (!session) redirect('/auth/signin');

  const { tenant: tenantCtx } = await getCurrentTenant(session.user.id);
  if (!tenantCtx) redirect('/');

  const tenant = await adminDb.tenant.findUnique({
    where: { id: tenantCtx.tenantId },
    select: { id: true, name: true, slug: true, branding: true, customDomains: true },
  });

  if (!tenant) redirect('/');

  const branding = (tenant.branding ?? {}) as Record<string, unknown>;

  return (
    <SettingsForm
      initialName={tenant.name}
      initialSlug={tenant.slug}
      initialDescription={typeof branding.description === 'string' ? branding.description : ''}
      initialTimezone={typeof branding.timezone === 'string' ? branding.timezone : ''}
      customDomains={tenant.customDomains}
    />
  );
}
