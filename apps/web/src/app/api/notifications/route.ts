import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getActivityType, humanizeAction } from '@/lib/audit-activity';
import { getTenantFromRequest } from '@/lib/server-tenant';

export const runtime = 'nodejs';

const RECENT_LIMIT = 20;

/**
 * GET /api/notifications
 * Feeds the topbar bell dropdown from the tenant's audit log — recent
 * entries plus an unread count based on the signed-in user's per-tenant
 * `lastNotificationsReadAt` watermark.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const user = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const [tenantUser, logs] = await Promise.all([
    adminDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId: user.id } },
      select: { lastNotificationsReadAt: true },
    }),
    adminDb.auditLog.findMany({
      where: { tenantId: tenantCtx.tenantId },
      orderBy: { occurredAt: 'desc' },
      take: RECENT_LIMIT,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  const lastReadAt = tenantUser?.lastNotificationsReadAt ?? null;
  const unreadCount = await adminDb.auditLog.count({
    where: {
      tenantId: tenantCtx.tenantId,
      ...(lastReadAt ? { occurredAt: { gt: lastReadAt } } : {}),
    },
  });

  const items = logs.map((log) => ({
    id: log.id.toString(),
    action: humanizeAction(log.action),
    type: getActivityType(log.action),
    subject: `${log.resourceType} · ${
      log.resourceId.length > 24 ? `${log.resourceId.slice(0, 24)}…` : log.resourceId
    }`,
    actor: log.actor?.email ?? 'System',
    occurredAt: log.occurredAt.toISOString(),
  }));

  return NextResponse.json({ items, unreadCount });
}

/**
 * POST /api/notifications
 * Marks the tenant's notifications as read for the signed-in user, advancing
 * their `lastNotificationsReadAt` watermark to now.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const user = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await adminDb.tenantUser.update({
    where: { tenantId_userId: { tenantId: tenantCtx.tenantId, userId: user.id } },
    data: { lastNotificationsReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
