import { redirect } from 'next/navigation';

import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

import SettingsForm from './_components/settings-form';

export const metadata = { title: 'Settings — General' };

export default async function SettingsGeneralPage() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
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
