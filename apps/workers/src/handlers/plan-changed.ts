import type { Job } from 'bullmq';

import { redis } from '@platform/db';
import { logger } from '@platform/logger';
import type { PlanChangedJob } from '@platform/jobs';

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
}
