import type { Job } from 'bullmq';

import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';
import type { UsageRollupJob } from '@platform/jobs';

export async function handleUsageRollup(job: Job<UsageRollupJob>): Promise<void> {
  const { tenantId, period } = job.data;
  logger.info({ jobId: job.id, tenantId, period }, 'Rolling up usage');

  const [year, month] = period.split('-').map(Number) as [number, number];
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const counts = await adminDb.usageEvent.groupBy({
    by: ['kind'],
    where: { tenantId, occurredAt: { gte: start, lt: end } },
    _sum: { quantity: true },
  });

  logger.info({ tenantId, period, counts }, 'Usage rollup complete');
}
