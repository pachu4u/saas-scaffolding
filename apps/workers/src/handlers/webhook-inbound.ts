import type { WebhookInboundJob } from '@platform/jobs';
import { logger } from '@platform/logger';
import type { Job } from 'bullmq';

export async function handleWebhookInbound(job: Job<WebhookInboundJob>): Promise<void> {
  const { source } = job.data;
  logger.info({ jobId: job.id, source }, 'Processing inbound webhook');

  // WebhookInboundJob.source only has one variant today; this stays a
  // dispatch point for when additional inbound webhook providers are added.
  const { processStripeEvent } = await import('@platform/billing');
  await processStripeEvent(job.data.rawBody, job.data.signature);
}
