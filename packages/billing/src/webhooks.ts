import type Stripe from 'stripe';

import { adminDb } from '@platform/db';
import type { Subscription } from '@platform/db';
import { enqueue, planChangedQueue } from '@platform/jobs';
import { logger } from '@platform/logger';

import { stripe } from './client.js';
import { env } from '@platform/config';

type SubscriptionStatus = Subscription['status'];

const HANDLED_EVENTS: Set<Stripe.Event['type']> = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]);

export async function processStripeEvent(rawBody: string, signature: string): Promise<void> {
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET ?? '');

  if (!HANDLED_EVENTS.has(event.type)) {
    logger.debug({ eventType: event.type }, 'Unhandled Stripe event — skipping');
    return;
  }

  // Idempotency: skip already-processed events
  const existing = await adminDb.idempotencyKey.findUnique({
    where: { key: `stripe:${event.id}` },
  });
  if (existing) {
    logger.info({ eventId: event.id }, 'Stripe event already processed — skipping');
    return;
  }

  await handleStripeEvent(event);

  // Record idempotency key (24h TTL)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await adminDb.idempotencyKey.create({
    data: {
      key: `stripe:${event.id}`,
      tenantId: (await getTenantIdFromEvent(event)) ?? '',
      requestHash: event.id,
      expiresAt,
    },
  });
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const tenantId = sub.metadata['tenantId'];
    if (!tenantId) return;

    const planCode = sub.metadata['planCode'] ?? 'free';
    const plan = await adminDb.plan.findUnique({ where: { code: planCode } });
    if (!plan) return;

    const existing = await adminDb.subscription.findUnique({ where: { tenantId } });

    await adminDb.subscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        status: mapStripeStatus(sub.status),
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
      create: {
        tenantId,
        planId: plan.id,
        status: mapStripeStatus(sub.status),
        stripeCustomerId: sub.customer as string,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });

    await enqueue(planChangedQueue, {
      tenantId,
      oldPlan: existing?.planId ?? 'free',
      newPlan: planCode,
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const tenantId = sub.metadata['tenantId'];
    if (!tenantId) return;

    await adminDb.subscription.update({
      where: { tenantId },
      data: { status: 'CANCELED' as SubscriptionStatus },
    });

    await enqueue(planChangedQueue, {
      tenantId,
      oldPlan: 'pro',
      newPlan: 'free',
    });
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'PAST_DUE',
    incomplete: 'PAST_DUE',
    incomplete_expired: 'CANCELED',
    paused: 'PAUSED',
  };
  return map[status] ?? 'ACTIVE';
}

async function getTenantIdFromEvent(event: Stripe.Event): Promise<string | null> {
  if ('metadata' in event.data.object) {
    const obj = event.data.object as { metadata?: Record<string, string> };
    return obj.metadata?.['tenantId'] ?? null;
  }
  return null;
}
