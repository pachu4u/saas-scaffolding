import { Permission, withAuthz } from '@platform/authz';
import type { Prisma } from '@platform/db';
import { adminDb } from '@platform/db';
import { invalidateTenantCache } from '@platform/tenant';
import { NextResponse } from 'next/server';

import { enqueueRoleSync } from '@/lib/role-sync';

export const runtime = 'nodejs';

/**
 * PATCH /api/settings/branding
 * Updates workspace branding (colors, email sender, login page copy).
 * All fields merged into the tenant.branding JSON column. Requires
 * SETTINGS_MANAGE.
 */
export const PATCH = withAuthz(
  { permission: Permission.SETTINGS_MANAGE },
  async (req, { authz }) => {
    const tenantCtx = { tenantId: authz.tenantId };

    const body = (await req.json()) as {
      section: 'colors' | 'logo' | 'email' | 'login';
      primaryColor?: string;
      accentColor?: string;
      bgColor?: string;
      logoText?: string;
      emailFrom?: string;
      emailReply?: string;
      emailFooter?: string;
      loginHeadline?: string;
      loginSubheading?: string;
      loginTestimonial?: string;
      loginSsoLabel?: string;
      loginPanelStyle?: string;
    };

    const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
    if (body.section === 'colors') {
      for (const field of ['primaryColor', 'accentColor', 'bgColor'] as const) {
        if (body[field] !== undefined && !HEX_RE.test(body[field])) {
          return NextResponse.json(
            { error: `${field} must be a valid hex color` },
            { status: 422 },
          );
        }
      }
    }

    // Merge incoming fields into branding JSON
    const currentTenant = await adminDb.tenant.findUnique({
      where: { id: tenantCtx.tenantId },
      select: { branding: true },
    });
    const current = (currentTenant?.branding ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current };

    const fields: (keyof typeof body)[] = [
      'primaryColor',
      'accentColor',
      'bgColor',
      'logoText',
      'emailFrom',
      'emailReply',
      'emailFooter',
      'loginHeadline',
      'loginSubheading',
      'loginTestimonial',
      'loginSsoLabel',
      'loginPanelStyle',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) merged[f] = body[f];
    }

    const tenant = await adminDb.tenant.update({
      where: { id: tenantCtx.tenantId },
      data: { branding: merged as Prisma.InputJsonValue },
      select: { id: true, slug: true, branding: true },
    });

    // Bust Redis cache so the new branding CSS is injected on the next page load
    await invalidateTenantCache(tenant.slug);

    // Push the updated branding to the tenant's Riogentix instance (and any
    // other connected app that cares) via the same outbox-driven convergence
    // loop identity changes use — see convergeBranding in app-sync-targets.ts.
    await enqueueRoleSync(tenantCtx.tenantId);

    await adminDb.auditLog.create({
      data: {
        tenantId: tenantCtx.tenantId,
        action: `settings.branding.${body.section}`,
        resourceType: 'Tenant',
        resourceId: tenantCtx.tenantId,
        after: merged as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true, branding: tenant.branding });
  },
);
