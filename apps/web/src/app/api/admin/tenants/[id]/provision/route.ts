import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { enqueue, tenantProvisionQueue, type TenantEnvironmentType } from '@platform/jobs';
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

/**
 * GET /api/admin/tenants/[id]/provision
 * Returns provisioning status and environments for a tenant.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const tenant = await adminDb.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      provisioningStatus: true,
      provisioningError: true,
      environments: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json(tenant);
}

/**
 * POST /api/admin/tenants/[id]/provision
 * Body: { environments: Array<'DEV' | 'TEST' | 'PROD'> }
 * Triggers provisioning for the specified environments.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPlatformAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { environments?: string[] };
  const envTypes = body.environments ?? ['DEV'];

  const validTypes = ['DEV', 'TEST', 'PROD'];
  const invalid = envTypes.filter((e) => !validTypes.includes(e));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid environment types: ${invalid.join(', ')}` },
      { status: 422 },
    );
  }

  const tenant = await adminDb.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // Update tenant provisioning status to IN_PROGRESS
  await adminDb.tenant.update({
    where: { id },
    data: { provisioningStatus: 'IN_PROGRESS', provisioningError: null },
  });

  // Create or update environment records
  await Promise.all(
    envTypes.map((type) =>
      adminDb.tenantEnvironment.upsert({
        where: { tenantId_type: { tenantId: id, type: type as 'DEV' | 'TEST' | 'PROD' } },
        create: { tenantId: id, type: type as 'DEV' | 'TEST' | 'PROD', status: 'PROVISIONING' },
        update: { status: 'PROVISIONING' },
      }),
    ),
  );

  // The worker owns provisioning (drives the stack driver + state machine);
  // the admin console polls provisioningStatus for the outcome. No idempotency
  // key: this endpoint is also the retry path, so each call must enqueue.
  await enqueue(tenantProvisionQueue, {
    tenantId: tenant.id,
    environments: envTypes as TenantEnvironmentType[],
  });

  return NextResponse.json({ ok: true, provisioningStatus: 'IN_PROGRESS', environments: envTypes });
}
