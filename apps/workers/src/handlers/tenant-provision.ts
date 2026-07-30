import { env } from '@platform/config';
import { adminDb, withLock } from '@platform/db';
import {
  appSyncQueue,
  enqueue,
  type TenantDeprovisionJob,
  type TenantProvisionJob,
} from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

import { getTenantStackDriver } from '../provisioning/index.js';

import { bootstrapTenantAdmin } from './riogentix-client.js';

// Provisioning can take minutes (kubernetes driver) and the admin route
// deliberately enqueues every retry without deduping (see its comment) so
// clicking "retry" always does something. That means two runs for the same
// tenant can be in flight at once; without serializing them, each one
// generates its own random DB-role password and the last ALTER ROLE to run
// can silently disagree with whichever run last wrote the k8s Secret.
const PROVISION_LOCK_TTL_MS = 10 * 60 * 1000;

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

  const { acquired } = await withLock(
    `lock:tenant-provision:${tenantId}`,
    PROVISION_LOCK_TTL_MS,
    () => runProvision(job, tenant, environments),
  );
  if (!acquired) {
    logger.info(
      { tenantId, jobId: job.id },
      'Provision job skipped — another run for this tenant is already in flight',
    );
  }
}

/**
 * Resolve the tenant's admin (holder of the platform-wide ``tenant_admin``
 * role binding — see ``/api/signup``) and grant them Riogentix's native
 * ``admin`` system role via bootstrap-admin. A failure here propagates to
 * ``runProvision``'s caller (no local try/catch): this repo's own precedent
 * (``/api/signup``'s roleBinding comment references a real incident where
 * tenants were stranded without an admin tile until backfilled by hand) is
 * to fail loudly rather than silently leave a tenant admin without access.
 */
async function bootstrapRiogentixTenantAdmin(tenantId: string): Promise<void> {
  const adminBinding = await adminDb.roleBinding.findFirst({
    where: { tenantId, role: { appId: null, name: 'tenant_admin' } },
    include: { user: true },
    orderBy: { user: { createdAt: 'asc' } },
  });
  if (!adminBinding) {
    logger.warn(
      { tenantId },
      'No tenant_admin role binding at provision time — skipping riogentix admin bootstrap (tenant created without a pre-assigned admin)',
    );
    return;
  }

  const { user } = adminBinding;
  const result = await bootstrapTenantAdmin(
    tenantId,
    user.email,
    user.email.split('@')[0] ?? null,
    'admin',
  );
  if (result) {
    logger.info(
      { tenantId, userId: user.id, riogentixUserId: result.userId },
      'Bootstrapped tenant admin with native riogentix "admin" role',
    );
  }
}

async function runProvision(
  job: Job<TenantProvisionJob>,
  tenant: { id: string; slug: string; plan: string },
  environments: TenantProvisionJob['environments'],
): Promise<void> {
  const { tenantId } = job.data;

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
    const { publicUrl, scimEndpoint } = await driver.provision({
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

    if (scimEndpoint) {
      const riogentixApp = await adminDb.connectedApp.upsert({
        where: { slug: 'riogentix' },
        create: { slug: 'riogentix', name: 'Riogentix' },
        update: {},
      });
      await adminDb.connectedAppInstance.upsert({
        where: { appId_tenantId: { appId: riogentixApp.id, tenantId } },
        create: {
          appId: riogentixApp.id,
          tenantId,
          scimBaseUrl: scimEndpoint.baseUrl,
          scimToken: scimEndpoint.token,
        },
        update: {
          scimBaseUrl: scimEndpoint.baseUrl,
          scimToken: scimEndpoint.token,
          status: 'ACTIVE',
        },
      });
      logger.info({ tenantId }, 'ConnectedAppInstance registered for Riogentix');

      // Grant the tenant's admin a real native AuthzRole assignment now,
      // rather than waiting on the SCIM convergence enqueued below — that
      // convergence only pushes *additive* native-role assignments for
      // app-scoped bindings (see convergeRiogentixRoleAssignments), and the
      // tenant_admin binding created at signup is the platform-wide generic
      // role, not an app-scoped one, so it was never going to reach
      // Riogentix on its own. Left unhandled, a freshly provisioned tenant's
      // admin would land in Riogentix with zero permissions — the same
      // failure mode as the stranded-admin incident referenced in
      // /api/signup's roleBinding comment, just one layer deeper. Not every
      // tenant-creation path pre-assigns an admin (the platform-admin
      // console's /api/tenants route doesn't), so a missing binding here is
      // a legitimate skip, not an error.
      await bootstrapRiogentixTenantAdmin(tenantId);

      // Trigger initial SCIM convergence so roles present at provision time are pushed.
      await adminDb.syncOutboxEvent.create({
        data: { tenantId, resourceType: 'TENANT', op: 'UPSERT', payload: {} },
      });
      await enqueue(appSyncQueue, { tenantId });
    }

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
  // Pause all connected app instances so the sync worker skips them until re-provisioned.
  await adminDb.connectedAppInstance.updateMany({
    where: { tenantId },
    data: { status: 'PAUSED' },
  });
  logger.info({ tenantId }, 'Tenant deprovisioned');
}
