import { Permission, withAuthz } from '@platform/authz';
import type { Prisma } from '@platform/db';
import { adminDb } from '@platform/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PATCH /api/settings/security
 * Persists SSO config and session policy into tenant.branding JSON.
 * Requires SETTINGS_MANAGE.
 */
export const PATCH = withAuthz(
  { permission: Permission.SETTINGS_MANAGE },
  async (req, { authz }) => {
    const tenantCtx = { tenantId: authz.tenantId };

    const body = (await req.json()) as {
      section: 'sso' | 'session';
      // SSO fields
      protocol?: 'SAML 2.0' | 'OIDC';
      idpIssuer?: string;
      idpSsoUrl?: string;
      idpCertificate?: string;
      attributeMapping?: Record<string, string>;
      // Session policy fields
      sessionLifetime?: string;
      enforceSso?: boolean;
      ipAllowlist?: boolean;
      mfaRequired?: boolean;
    };

    const currentTenant = await adminDb.tenant.findUnique({
      where: { id: tenantCtx.tenantId },
      select: { branding: true },
    });
    const current = (currentTenant?.branding ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };

    if (body.section === 'sso') {
      const sso: Record<string, unknown> =
        (merged.sso as Record<string, unknown> | undefined) ?? {};
      if (body.protocol !== undefined) sso.protocol = body.protocol;
      if (body.idpIssuer !== undefined) sso.idpIssuer = body.idpIssuer;
      if (body.idpSsoUrl !== undefined) sso.idpSsoUrl = body.idpSsoUrl;
      if (body.idpCertificate !== undefined) sso.idpCertificate = body.idpCertificate;
      if (body.attributeMapping !== undefined) sso.attributeMapping = body.attributeMapping;
      merged.sso = sso;
    } else {
      const policy: Record<string, unknown> =
        (merged.sessionPolicy as Record<string, unknown> | undefined) ?? {};
      if (body.sessionLifetime !== undefined) policy.sessionLifetime = body.sessionLifetime;
      if (body.enforceSso !== undefined) policy.enforceSso = body.enforceSso;
      if (body.ipAllowlist !== undefined) policy.ipAllowlist = body.ipAllowlist;
      if (body.mfaRequired !== undefined) policy.mfaRequired = body.mfaRequired;
      merged.sessionPolicy = policy;
    }

    const tenant = await adminDb.tenant.update({
      where: { id: tenantCtx.tenantId },
      data: { branding: merged as Prisma.InputJsonValue },
      select: { id: true, branding: true },
    });

    await adminDb.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        action: `settings.security.${body.section}`,
        resourceType: 'Tenant',
        resourceId: tenantCtx.tenantId,
        after: (body.section === 'sso'
          ? { sso: merged.sso }
          : { sessionPolicy: merged.sessionPolicy }) as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true, branding: tenant.branding });
  },
);
