import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/settings/compliance/export
 * Downloads a JSON snapshot of the workspace's data: tenant record, members,
 * notes, subscription, and recent audit history. Secrets (webhook signing
 * secrets, SCIM tokens, API keys) are deliberately excluded.
 *
 * This stack has no object storage configured, so unlike a BullMQ-job +
 * signed-URL flow this builds and streams the export synchronously — honest
 * given current infra, and fine at this data scale.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantSlug =
    req.headers.get('x-tenant-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG;
  if (!tenantSlug) return NextResponse.json({ error: 'No tenant context' }, { status: 400 });

  const tenantCtx = await resolveTenant(tenantSlug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { tenantId } = tenantCtx;

  const [tenant, members, notes, subscription, auditLog] = await Promise.all([
    adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true, plan: true, createdAt: true },
    }),
    adminDb.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { email: true } } },
    }),
    adminDb.note.findMany({ where: { tenantId } }),
    adminDb.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    adminDb.auditLog.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: 1000,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    tenant,
    members: members.map((m) => ({
      email: m.user.email,
      status: m.status,
      joinedAt: m.joinedAt,
    })),
    notes,
    subscription,
    auditLog: auditLog.map((log) => ({
      occurredAt: log.occurredAt,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      actorEmail: log.actor?.email ?? null,
    })),
  };

  await adminDb.auditLog.create({
    data: {
      tenantId,
      actorUserId: session.user.id,
      action: 'compliance.data_exported',
      resourceType: 'Tenant',
      resourceId: tenantId,
    },
  });

  const filename = `${tenant.slug}-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
