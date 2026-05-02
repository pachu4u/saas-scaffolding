import { Queue, type JobsOptions } from 'bullmq';

import { env } from '@platform/config';

const connection = { url: env.REDIS_URL };

const DEFAULT_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

function makeQueue<T>(name: string, opts?: JobsOptions) {
  return new Queue<T>(name, { connection, defaultJobOptions: { ...DEFAULT_OPTS, ...opts } });
}

// Typed queue definitions
export const emailQueue = makeQueue<EmailJob>('email');
export const webhookInboundQueue = makeQueue<WebhookInboundJob>('webhook-inbound');
export const webhookOutboundQueue = makeQueue<WebhookOutboundJob>('webhook-outbound');
export const usageRollupQueue = makeQueue<UsageRollupJob>('usage-rollup');
export const planChangedQueue = makeQueue<PlanChangedJob>('plan-changed');

export type EmailJob = {
  to: string;
  subject: string;
  templateId: string;
  data: Record<string, unknown>;
  tenantId: string;
};

export type WebhookInboundJob = {
  source: 'stripe';
  rawBody: string;
  signature: string;
};

export type WebhookOutboundJob = {
  endpointId: string;
  deliveryId: string;
  event: Record<string, unknown>;
};

export type UsageRollupJob = {
  tenantId: string;
  period: string; // YYYY-MM
};

export type PlanChangedJob = {
  tenantId: string;
  oldPlan: string;
  newPlan: string;
};

/**
 * Enqueue with idempotency protection.
 * Wraps BullMQ's built-in job deduplication via `jobId`.
 */
export async function enqueue<T>(
  queue: Queue<T>,
  payload: T,
  opts?: JobsOptions & { idempotencyKey?: string },
): Promise<string | undefined> {
  const { idempotencyKey, ...jobOpts } = opts ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = await queue.add(queue.name as any, payload as any, {
    ...jobOpts,
    ...(idempotencyKey ? { jobId: idempotencyKey } : {}),
  });
  return job.id;
}
