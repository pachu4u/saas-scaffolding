import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { getTenantFromRequest } from '../../../lib/server-tenant';

export const runtime = 'nodejs';

/**
 * GET /api/usage
 * Returns usage event counts grouped by kind and month for the current tenant.
 * Query params: ?months=6 (default 6 months lookback)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantCtx = await getTenantFromRequest(req);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const months = Math.min(Number(req.nextUrl.searchParams.get('months') ?? '6'), 24);
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  // Aggregate usage events by kind and calendar month
  const events = await adminDb.usageEvent.findMany({
    where: { tenantId: tenantCtx.tenantId, occurredAt: { gte: since } },
    select: { kind: true, quantity: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  });

  // Group client-side to avoid raw SQL
  const byKindMonth: Record<string, Record<string, number>> = {};
  for (const ev of events) {
    const month = ev.occurredAt.toISOString().slice(0, 7); // YYYY-MM
    const monthBucket = (byKindMonth[ev.kind] ??= {});
    monthBucket[month] = (monthBucket[month] ?? 0) + ev.quantity;
  }

  // Build a sorted list of months in range
  const allMonths: string[] = [];
  const cursor = new Date(since);
  const now = new Date();
  while (cursor <= now) {
    allMonths.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const series = Object.entries(byKindMonth).map(([kind, monthMap]) => ({
    kind,
    data: allMonths.map((month) => ({ month, value: monthMap[month] ?? 0 })),
    total: Object.values(monthMap).reduce((a, b) => a + b, 0),
  }));

  return NextResponse.json({ months: allMonths, series });
}
