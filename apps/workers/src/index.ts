import { env } from '@platform/config';
import {
  appSyncReconcileQueue,
  type EmailJob,
  type WebhookInboundJob,
  type WebhookOutboundJob,
  type UsageRollupJob,
  type PlanChangedJob,
  type TenantProvisionJob,
  type TenantDeprovisionJob,
  type AppSyncJob,
} from '@platform/jobs';
import { logger } from '@platform/logger';
import { Worker, type Job } from 'bullmq';

import { handleAppSyncReconcile } from './handlers/app-sync-reconcile.js';
import { handleAppSync } from './handlers/app-sync.js';
import { handleEmail } from './handlers/email.js';
import { handlePlanChanged } from './handlers/plan-changed.js';
import { handleTenantDeprovision, handleTenantProvision } from './handlers/tenant-provision.js';
import { handleUsageRollup } from './handlers/usage-rollup.js';
import { handleWebhookInbound } from './handlers/webhook-inbound.js';
import { handleWebhookOutbound } from './handlers/webhook-outbound.js';

const connection = { url: env.REDIS_URL };

type AnyJobHandler = (job: Job) => Promise<void>;

function makeWorker(name: string, handler: AnyJobHandler, concurrency = 5) {
  const worker = new Worker(name, handler, {
    connection,
    concurrency,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: name, err }, 'Job failed');
  });

  logger.info({ queue: name }, 'Worker started');
  return worker;
}

const workers = [
  makeWorker('email', (job) => handleEmail(job as Job<EmailJob>)),
  makeWorker('webhook-inbound', (job) => handleWebhookInbound(job as Job<WebhookInboundJob>)),
  makeWorker('webhook-outbound', (job) => handleWebhookOutbound(job as Job<WebhookOutboundJob>)),
  makeWorker('usage-rollup', (job) => handleUsageRollup(job as Job<UsageRollupJob>)),
  makeWorker('plan-changed', (job) => handlePlanChanged(job as Job<PlanChangedJob>)),
  ...(env.WORKER_ENABLE_APP_SYNC
    ? [
        // Outbox drains are per-tenant converges — serialize them so two
        // drains for the same tenant can't interleave SCIM writes.
        makeWorker('app-sync', (job) => handleAppSync(job as Job<AppSyncJob>), 1),
        // Reconcile tick — see handlers/app-sync-reconcile.ts. Gated behind
        // the same flag as app-sync itself since it just feeds that queue,
        // and running it from every worker process would fire duplicate
        // ticks (each pod schedules its own repeatable job under a distinct
        // jobId by default in BullMQ >=5, so unguarded this would double up
        // instead of coalescing).
        makeWorker('app-sync-reconcile', () => handleAppSyncReconcile(), 1),
      ]
    : []),
  ...(env.WORKER_ENABLE_TENANT_PROVISIONING
    ? [
        // Provisioning waits on pod readiness (minutes, not ms) — keep
        // concurrency low so a burst of signups can't pin every worker slot
        // on rollout waits.
        makeWorker(
          'tenant-provision',
          (job) => handleTenantProvision(job as Job<TenantProvisionJob>),
          2,
        ),
        makeWorker(
          'tenant-deprovision',
          (job) => handleTenantDeprovision(job as Job<TenantDeprovisionJob>),
          2,
        ),
      ]
    : []),
];

if (env.WORKER_ENABLE_APP_SYNC) {
  // Upserts the repeatable job — safe to call on every boot/restart, BullMQ
  // keys repeatable jobs by name + repeat options so this doesn't create
  // duplicates or reset the schedule.
  void appSyncReconcileQueue
    .add(
      'app-sync-reconcile',
      {},
      { repeat: { every: env.APP_SYNC_RECONCILE_INTERVAL_MS }, jobId: 'app-sync-reconcile-tick' },
    )
    .then(() => {
      logger.info(
        { intervalMs: env.APP_SYNC_RECONCILE_INTERVAL_MS },
        'App sync reconcile — repeatable job scheduled',
      );
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to schedule app-sync reconcile');
    });
}

logger.info('All workers registered. Listening for jobs...');

// Graceful shutdown — let in-flight jobs finish before exiting
async function shutdown() {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
