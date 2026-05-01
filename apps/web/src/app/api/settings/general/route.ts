import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';

export const runtime = 'nodejs';

/**
 * PATCH /api/settings/general
 * Updates workspace name, slug, description, and timezone.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json()) as {
    name?: string;
    slug?: string;
    description?: string;
    timezone?: string;
  };

  const { name, slug, description, timezone } = body;

  // Validate
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 422 });
  }
  if (slug !== undefined) {
    if (typeof slug !== 'string' || !/^[a-z0-9-]{2,63}$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be 2–63 lowercase alphanumeric characters or hyphens' },
        { status: 422 },
      );
    }
    // Ensure slug is not already taken by another tenant
    const existing = await adminDb.tenant.findFirst({
      where: { slug, id: { not: tenantCtx.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
    }
  }

  // Merge description/timezone into branding JSON
  const currentTenant = await adminDb.tenant.findUnique({
    where: { id: tenantCtx.id },
    select: { branding: true },
  });
  const currentBranding = (currentTenant?.branding ?? {}) as Record<string, unknown>;
  const updatedBranding: Record<string, unknown> = { ...currentBranding };
  if (description !== undefined) updatedBranding.description = description;
  if (timezone !== undefined) updatedBranding.timezone = timezone;

  const updateData: Record<string, unknown> = { branding: updatedBranding };
  if (name !== undefined) updateData.name = name.trim();
  if (slug !== undefined) updateData.slug = slug;

  const tenant = await adminDb.tenant.update({
    where: { id: tenantCtx.id },
    data: updateData,
    select: { id: true, name: true, slug: true, branding: true },
  });

  await adminDb.auditLog.create({
    data: {
      tenantId: tenantCtx.id,
      action: 'settings.general.update',
      resourceType: 'Tenant',
      resourceId: tenantCtx.id,
      after: updateData,
    },
  });

  return NextResponse.json({ ok: true, tenant });
}
