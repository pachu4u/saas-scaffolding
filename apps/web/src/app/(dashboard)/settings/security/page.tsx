import { redirect } from 'next/navigation';

import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

import { SecurityForm } from '../_components/security-form';

export const metadata = { title: 'Security — Settings' };

export default async function SecurityPage() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) redirect('/');

  const [tenant, scimToken, memberCount] = await Promise.all([
    adminDb.tenant.findUnique({
      where: { id: tenantCtx.tenantId },
      select: { slug: true, name: true, branding: true, customDomains: true },
    }),
    adminDb.scimToken.findFirst({
      where: { tenantId: tenantCtx.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, lastUsedAt: true },
    }),
    adminDb.tenantUser.count({ where: { tenantId: tenantCtx.tenantId } }),
  ]);

  if (!tenant) redirect('/');

  const branding = (tenant.branding ?? {}) as Record<string, unknown>;
  const sso = (branding.sso ?? {}) as Record<string, unknown>;
  const sessionPolicy = (branding.sessionPolicy ?? {}) as Record<string, unknown>;

  // Derive app domain from first custom domain or tenant slug
  const appDomain = tenant.customDomains[0] ?? `${tenant.slug}.riogentix.app`;

  return (
    <SecurityForm
      appDomain={appDomain}
      ssoConfigured={!!sso.idpIssuer}
      initialProtocol={(sso.protocol as 'SAML 2.0' | 'OIDC' | undefined) ?? 'SAML 2.0'}
      initialIdpIssuer={(sso.idpIssuer as string | undefined) ?? ''}
      initialIdpSsoUrl={(sso.idpSsoUrl as string | undefined) ?? ''}
      initialIdpCertificate={(sso.idpCertificate as string | undefined) ?? ''}
      initialSessionLifetime={(sessionPolicy.sessionLifetime as string | undefined) ?? '8 hours'}
      initialEnforceSso={(sessionPolicy.enforceSso as boolean | undefined) ?? false}
      initialIpAllowlist={(sessionPolicy.ipAllowlist as boolean | undefined) ?? false}
      initialMfaRequired={(sessionPolicy.mfaRequired as boolean | undefined) ?? false}
      scimConfigured={!!scimToken}
      scimTokenName={scimToken?.name ?? null}
      scimLastUsedAt={scimToken?.lastUsedAt?.toISOString() ?? null}
      memberCount={memberCount}
    />
  );
}
