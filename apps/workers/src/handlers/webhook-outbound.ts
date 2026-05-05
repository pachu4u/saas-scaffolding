import type { Job } from 'bullmq';

import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';
import type { WebhookOutboundJob } from '@platform/jobs';

export async function handleWebhookOutbound(job: Job<WebhookOutboundJob>): Promise<void> {
  const { endpointId, deliveryId, event } = job.data;

  const endpoint = await adminDb.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { url: true, secret: true, status: true },
  });

  if (!endpoint || endpoint.status !== 'ACTIVE') {
    logger.warn({ deliveryId }, 'Webhook endpoint not found or inactive');
    return;
  }

  const body = JSON.stringify(event);
  const sig = await hmacSign(endpoint.secret, body);

  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': sig,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  await adminDb.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: res.ok ? 'SUCCESS' : 'FAILED',
      attempts: { increment: 1 },
      lastError: res.ok ? null : `HTTP ${res.status.toString()}`,
    },
  });

  if (!res.ok) throw new Error(`Webhook delivery failed: HTTP ${res.status.toString()}`);
  logger.info({ deliveryId, status: res.status }, 'Webhook delivered');
}

async function hmacSign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Buffer.from(sig).toString('hex');
}
