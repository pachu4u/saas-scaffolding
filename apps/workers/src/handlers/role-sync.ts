import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import type { RoleSyncJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

import { syncTenantRoleAssignments } from '../provisioning/kubernetes-driver.js';

/**
 * Push the tenant's current role bindings to its Riogentix instance.
 *
 * Enqueued by the console's role-mutation routes (invite, role change, role
 * edit/delete) so RBAC changes propagate without waiting for a re-provision.
 * The sync reads the full binding set at run time, so any number of queued
 * jobs converge on the latest state.
 */
export async function handleRoleSync(job: Job<RoleSyncJob>): Promise<void> {
  const { tenantId } = job.data;

  const tenant = await adminDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    logger.warn({ tenantId, jobId: job.id }, 'Role-sync job for missing tenant — skipping');
    return;
  }

  if (env.TENANT_STACK_DRIVER !== 'kubernetes') {
    // Shared topology has no per-tenant instance to push to.
    logger.info({ tenantId }, 'Role sync skipped — tenant stack driver is not kubernetes');
    return;
  }

  if (tenant.provisioningStatus !== 'COMPLETED') {
    // Provisioning runs its own role sync once the stack is up.
    logger.info(
      { tenantId, provisioningStatus: tenant.provisioningStatus },
      'Role sync skipped — tenant stack not provisioned yet',
    );
    return;
  }

  await syncTenantRoleAssignments({ id: tenant.id, slug: tenant.slug });
}
