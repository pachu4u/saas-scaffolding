import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { resolveTenant } from '@platform/tenant';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/audit/export
 * Downloads audit logs as a CSV file. Respects the same filters as the UI page.
 * Limited to 5,000 rows to prevent abuse.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'acme';
  const tenantCtx = await resolveTenant(slug);
  if (!tenantCtx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { tenantId } = tenantCtx;
  const { searchParams } = req.nextUrl;

  const action = searchParams.get('action');
  const resource = searchParams.get('resource');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) fromDate = d;
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      toDate = d;
    }
  }

  const logs = await adminDb.auditLog.findMany({
    where: {
      tenantId,
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(resource && { resourceType: { equals: resource, mode: 'insensitive' } }),
      ...((fromDate ?? toDate) && {
        occurredAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 5000,
    include: { actor: { select: { email: true } } },
  });

  const header = ['occurredAt', 'action', 'resourceType', 'resourceId', 'actorEmail', 'ip'].join(
    ',',
  );

  const rows = logs.map((log) => {
    const cols = [
      log.occurredAt.toISOString(),
      log.action,
      log.resourceType,
      log.resourceId,
      log.actor?.email ?? '',
      log.ip ?? '',
    ];
    return cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
