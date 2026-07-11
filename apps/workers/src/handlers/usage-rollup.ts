import { type PlanCode, PLAN_FEATURES, setUsageLock } from '@platform/billing';
import { adminDb } from '@platform/db';
import type { UsageRollupJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

const PLAN_QUOTAS: Record<PlanCode, number | null> = {
  free: 1000,
  pro: 50000,
  enterprise: null,
};

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

  // Determine the tenant's active plan (default free if no subscription)
  const subscription = await adminDb.subscription.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    include: { plan: { select: { code: true } } },
  });
  const planCode = (subscription?.plan.code ?? 'free') as PlanCode;

  // Validate we have a known plan
  if (!(planCode in PLAN_FEATURES)) {
    logger.warn({ tenantId, planCode }, 'Unknown plan for quota check — skipping');
    return;
  }

  const quota = PLAN_QUOTAS[planCode];

  // Enforce quota via Riogentix usage lock
  try {
    if (quota !== null && totalEvents > quota) {
      await setUsageLock(tenantId, true);
      await adminDb.auditLog.create({
        data: {
          tenantId,
          action: 'usage.quota_exceeded',
          resourceType: 'UsageSummary',
          resourceId: period,
          after: { totalEvents, quota, plan: planCode },
        },
      });
      logger.warn(
        { tenantId, plan: planCode, totalEvents, quota },
        'Quota exceeded — usage lock set',
      );
    } else {
      await setUsageLock(tenantId, false);
    }
  } catch (err) {
    logger.error(
      { tenantId, plan: planCode, totalEvents, err },
      'Riogentix usage lock call failed',
    );
  }
}
