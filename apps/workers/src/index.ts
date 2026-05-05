import { Worker, type Job } from 'bullmq';

import { env } from '@platform/config';
import { logger } from '@platform/logger';
import type {
  EmailJob,
  WebhookInboundJob,
  WebhookOutboundJob,
  UsageRollupJob,
  PlanChangedJob,
} from '@platform/jobs';

import { handleEmail } from './handlers/email.js';
import { handleWebhookInbound } from './handlers/webhook-inbound.js';
import { handleWebhookOutbound } from './handlers/webhook-outbound.js';
import { handleUsageRollup } from './handlers/usage-rollup.js';
import { handlePlanChanged } from './handlers/plan-changed.js';

const connection = { url: env.REDIS_URL };

type AnyJobHandler = (job: Job) => Promise<void>;

function makeWorker(name: string, handler: AnyJobHandler) {
  const worker = new Worker(name, handler, {
    connection,
    concurrency: 5,
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

makeWorker('email', (job) => handleEmail(job as Job<EmailJob>));
makeWorker('webhook-inbound', (job) => handleWebhookInbound(job as Job<WebhookInboundJob>));
makeWorker('webhook-outbound', (job) => handleWebhookOutbound(job as Job<WebhookOutboundJob>));
makeWorker('usage-rollup', (job) => handleUsageRollup(job as Job<UsageRollupJob>));
makeWorker('plan-changed', (job) => handlePlanChanged(job as Job<PlanChangedJob>));

logger.info('All workers registered. Listening for jobs...');

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down workers...');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
