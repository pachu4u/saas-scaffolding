import { redis } from '@platform/db';
import type { PlanChangedJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

import { setUsageLock, syncPlan } from './riogentix-client.js';

export async function handlePlanChanged(job: Job<PlanChangedJob>): Promise<void> {
  const { tenantId, oldPlan, newPlan } = job.data;
  logger.info({ jobId: job.id, tenantId, oldPlan, newPlan }, 'Plan changed — invalidating caches');

  // Invalidate all authz caches for this tenant (plan affects entitlements)
  const keys = await redis.keys(`authz:${tenantId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Also invalidate tenant cache so branding / plan reads are fresh
  await redis.del(`tenant:slug:*`);

  logger.info({ tenantId, invalidated: keys.length }, 'Caches invalidated after plan change');

  // Sync new plan to riogentix and lift any existing usage lock (upgrade may
  // push them above the old tier's cap, so let the next rollup re-evaluate).
  await syncPlan(tenantId, newPlan);
  if (newPlan !== oldPlan) {
    await setUsageLock(tenantId, false);
  }
}
