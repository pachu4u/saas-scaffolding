import { env } from '@platform/config';
import { Queue, type JobsOptions } from 'bullmq';

const connection = { url: env.REDIS_URL };

const DEFAULT_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

function createQueue<T>(name: string, opts?: JobsOptions) {
  return new Queue<T>(name, { connection, defaultJobOptions: { ...DEFAULT_OPTS, ...opts } });
}

/**
 * Returns a Proxy that looks exactly like a Queue<T> but defers the actual
 * `new Queue()` (and therefore the Redis connection) until the first property
 * access.  This prevents BullMQ from connecting at module-load time during
 * `next build`, while leaving all call-sites unchanged.
 */
function lazyQueue<T>(name: string, opts?: JobsOptions): Queue<T> {
  let instance: Queue<T> | undefined;
  return new Proxy({} as Queue<T>, {
    get(_target, prop, _receiver) {
      instance ??= createQueue<T>(name, opts);
      const value: unknown = Reflect.get(instance, prop, instance);
      // Bind methods so `this` stays correct
      return typeof value === 'function' ? (value.bind(instance) as unknown) : value;
    },
    set(_target, prop, value) {
      instance ??= createQueue<T>(name, opts);
      return Reflect.set(instance, prop, value);
    },
  });
}

// Typed queue definitions — connections are deferred until first use
export const emailQueue = lazyQueue<EmailJob>('email');
export const webhookInboundQueue = lazyQueue<WebhookInboundJob>('webhook-inbound');
export const webhookOutboundQueue = lazyQueue<WebhookOutboundJob>('webhook-outbound');
export const usageRollupQueue = lazyQueue<UsageRollupJob>('usage-rollup');
export const planChangedQueue = lazyQueue<PlanChangedJob>('plan-changed');

export interface EmailJob {
  to: string;
  subject: string;
  templateId: string;
  data: Record<string, unknown>;
  tenantId: string;
}

export interface WebhookInboundJob {
  source: 'stripe';
  rawBody: string;
  signature: string;
}

export interface WebhookOutboundJob {
  endpointId: string;
  deliveryId: string;
  event: Record<string, unknown>;
}

export interface UsageRollupJob {
  tenantId: string;
  period: string; // YYYY-MM
}

export interface PlanChangedJob {
  tenantId: string;
  oldPlan: string;
  newPlan: string;
}

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
  // BullMQ's Queue<T>.add name param type depends on T in a way the generic
  // wrapper here can't resolve — this is a real upstream typing limitation,
  // not something to work around.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  const job = await queue.add(queue.name as any, payload as any, {
    ...jobOpts,
    ...(idempotencyKey ? { jobId: idempotencyKey } : {}),
  });
  return job.id;
}
