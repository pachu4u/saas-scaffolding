import { auth } from '@platform/auth';
import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

import { provisionRiogentixTenant } from '@/lib/riogentix-provision';

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

  // Real provisioning: upsert the tenant in Riogentix (idempotent, so this
  // doubles as the retry path for tenants whose signup-time provision failed),
  // then activate the environment records. Runs after the response is sent;
  // the admin console polls provisioningStatus for the outcome.
  void runProvisioning(
    { id: tenant.id, slug: tenant.slug, plan: tenant.plan },
    envTypes as ('DEV' | 'TEST' | 'PROD')[],
  );

  return NextResponse.json({ ok: true, provisioningStatus: 'IN_PROGRESS', environments: envTypes });
}

async function runProvisioning(
  tenant: { id: string; slug: string; plan: string },
  envTypes: ('DEV' | 'TEST' | 'PROD')[],
) {
  try {
    await provisionRiogentixTenant(tenant.id, tenant.plan, tenant.slug);

    const workspaceUrl = env.AUTH_URL.replace('saas.', `${tenant.slug}.`);
    await Promise.all(
      envTypes.map((type) =>
        adminDb.tenantEnvironment.update({
          where: { tenantId_type: { tenantId: tenant.id, type } },
          data: {
            status: 'ACTIVE',
            endpoint: type === 'PROD' ? workspaceUrl : `${workspaceUrl}?env=${type.toLowerCase()}`,
          },
        }),
      ),
    );
    await adminDb.tenant.update({
      where: { id: tenant.id },
      data: { provisioningStatus: 'COMPLETED', provisioningError: null },
    });
  } catch (err) {
    await adminDb.tenant.update({
      where: { id: tenant.id },
      data: {
        provisioningStatus: 'FAILED',
        provisioningError: String(err),
      },
    });
  }
}
