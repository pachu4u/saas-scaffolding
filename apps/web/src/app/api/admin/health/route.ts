import { auth } from '@platform/auth';
import { NextResponse } from 'next/server';

import { getSystemHealth } from '@/lib/system-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

/**
 * GET /api/admin/health
 * Full dependency health report (Postgres, Redis, Keycloak, BullMQ, Vault).
 * Platform-admin only, since the details name internal services. Returns 503
 * when any check is down so it can also back an authenticated uptime monitor.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const report = await getSystemHealth();
  return NextResponse.json(report, {
    status: report.status === 'down' ? 503 : 200,
    headers: { 'cache-control': 'no-store' },
  });
}
