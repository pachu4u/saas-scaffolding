import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { enqueue, tenantDeprovisionQueue } from '@platform/jobs';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isPlatformAdmin(session: { groups?: unknown }): boolean {
  return (
    Array.isArray(session.groups) &&
    (session.groups as string[]).some((g) =>
      ['platform_super_admin', 'platform_support'].includes(g),
    )
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { action?: string };
  const { action } = body;

  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 422 });

  const tenant = await adminDb.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  if (action === 'suspend') {
    await adminDb.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
    return NextResponse.json({ ok: true, status: 'SUSPENDED' });
  }
  if (action === 'reinstate') {
    await adminDb.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
    return NextResponse.json({ ok: true, status: 'ACTIVE' });
  }
  if (action === 'delete') {
    if (tenant.status === 'DELETED') {
      return NextResponse.json({ error: 'Tenant already deleted' }, { status: 422 });
    }
    // Soft delete — tenant rows are kept for audit/usage history (see
    // TenantStatus.DELETED). The worker tears the tenant's app/infra down
    // (kubernetes driver: deletes its namespace; shared driver: no-op) —
    // same job the "Deprovision" flow already used, just triggered here too.
    await adminDb.tenant.update({ where: { id }, data: { status: 'DELETED' } });
    await enqueue(tenantDeprovisionQueue, { tenantId: id });
    return NextResponse.json({ ok: true, status: 'DELETED' });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
