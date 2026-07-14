import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import type { TenantDeprovisionJob, TenantProvisionJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

import { getTenantStackDriver } from '../provisioning/index.js';

/**
 * Tenant stack provisioning — the state machine lives here, the
 * infrastructure work lives in the driver. Every step is idempotent, so a
 * BullMQ retry after a partial failure converges instead of duplicating.
 *
 * tenants.provisioning_status: PENDING → IN_PROGRESS → COMPLETED | FAILED
 * tenant_environments.status:  PENDING → PROVISIONING → ACTIVE | FAILED
 */
export async function handleTenantProvision(job: Job<TenantProvisionJob>): Promise<void> {
  const { tenantId, environments } = job.data;

  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    // Tenant deleted between enqueue and run — nothing to converge to.
    logger.warn({ tenantId, jobId: job.id }, 'Provision job for missing tenant — skipping');
    return;
  }

  await adminDb.tenant.update({
    where: { id: tenantId },
    data: { provisioningStatus: 'IN_PROGRESS', provisioningError: null },
  });
  await Promise.all(
    environments.map((type) =>
      adminDb.tenantEnvironment.upsert({
        where: { tenantId_type: { tenantId, type } },
        create: { tenantId, type, status: 'PROVISIONING' },
        update: { status: 'PROVISIONING' },
      }),
    ),
  );

  try {
    const driver = getTenantStackDriver();
    const { publicUrl } = await driver.provision({
      id: tenant.id,
      slug: tenant.slug,
      plan: tenant.plan,
    });

    // Shared topology has no per-tenant URL — tenants are served from the
    // platform's own wildcard domain (same derivation the admin route used).
    const workspaceUrl = publicUrl ?? env.AUTH_URL.replace('saas.', `${tenant.slug}.`);
    await Promise.all(
      environments.map((type) =>
        adminDb.tenantEnvironment.update({
          where: { tenantId_type: { tenantId, type } },
          data: {
            status: 'ACTIVE',
            endpoint: type === 'PROD' ? workspaceUrl : `${workspaceUrl}?env=${type.toLowerCase()}`,
          },
        }),
      ),
    );
    await adminDb.tenant.update({
      where: { id: tenantId },
      data: { provisioningStatus: 'COMPLETED', provisioningError: null },
    });
    logger.info({ tenantId, driver: driver.name }, 'Tenant provisioned');
  } catch (err) {
    await adminDb.tenant.update({
      where: { id: tenantId },
      data: { provisioningStatus: 'FAILED', provisioningError: String(err) },
    });
    await adminDb.tenantEnvironment.updateMany({
      where: { tenantId, type: { in: environments } },
      data: { status: 'FAILED' },
    });
    // Rethrow so BullMQ retries; the admin console can also re-enqueue later.
    throw err;
  }
}

/**
 * Tears down the tenant's compute/routing (namespace in the kubernetes
 * driver). Data is retained; environments return to PENDING so the tenant can
 * be re-provisioned.
 */
export async function handleTenantDeprovision(job: Job<TenantDeprovisionJob>): Promise<void> {
  const { tenantId } = job.data;

  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    logger.warn({ tenantId, jobId: job.id }, 'Deprovision job for missing tenant — skipping');
    return;
  }

  await getTenantStackDriver().deprovision({ id: tenant.id, slug: tenant.slug });

  await adminDb.tenantEnvironment.updateMany({
    where: { tenantId },
    data: { status: 'PENDING', endpoint: null },
  });
  await adminDb.tenant.update({
    where: { id: tenantId },
    data: { provisioningStatus: 'PENDING', provisioningError: null },
  });
  logger.info({ tenantId }, 'Tenant deprovisioned');
}
