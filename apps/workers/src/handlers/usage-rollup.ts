import type { Job } from 'bullmq';

import { adminDb } from '@platform/db';
import type { UsageRollupJob } from '@platform/jobs';
import { logger } from '@platform/logger';

export async function handleUsageRollup(job: Job<UsageRollupJob>): Promise<void> {
  const { tenantId, period } = job.data;
  logger.info({ jobId: job.id, tenantId, period }, 'Rolling up usage');

  const [year, month] = period.split('-').map(Number) as [number, number];
  if (!year || !month) throw new Error(`Invalid period format: ${period}`);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const counts = await adminDb.usageEvent.groupBy({
    by: ['kind'],
    where: { tenantId, occurredAt: { gte: start, lt: end } },
    _sum: { quantity: true },
  });

  // Build summary map: { kind -> total_quantity }
  const summary = Object.fromEntries(counts.map((c) => [c.kind, c._sum.quantity ?? 0]));

  const totalEvents = Object.values(summary).reduce((a, b) => a + b, 0);

  // Persist rollup summary in AuditLog (no dedicated rollup table yet).
  // Each call is idempotent: we delete the previous rollup entry for this
  // tenant+period before writing, so re-runs don't accumulate duplicates.
  await adminDb.$transaction([
    adminDb.auditLog.deleteMany({
      where: {
        tenantId,
        action: 'usage.rollup',
        resourceId: period,
      },
    }),
    adminDb.auditLog.create({
      data: {
        tenantId,
        action: 'usage.rollup',
        resourceType: 'UsageSummary',
        resourceId: period,
        after: summary,
      },
    }),
  ]);

  logger.info(
    { jobId: job.id, tenantId, period, totalEvents, kinds: Object.keys(summary) },
    'Usage rollup persisted',
  );
}
