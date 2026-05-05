import type { Job } from 'bullmq';

import { logger } from '@platform/logger';
import type { WebhookInboundJob } from '@platform/jobs';

export async function handleWebhookInbound(job: Job<WebhookInboundJob>): Promise<void> {
  const { source } = job.data;
  logger.info({ jobId: job.id, source }, 'Processing inbound webhook');

  if (source === 'stripe') {
    const { processStripeEvent } = await import('@platform/billing');
    await processStripeEvent(job.data.rawBody, job.data.signature);
  }
}
