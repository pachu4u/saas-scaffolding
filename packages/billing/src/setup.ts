import { adminDb } from '@platform/db';
import { getPlatformSecrets } from '@platform/vault';
import Stripe from 'stripe';

export interface StripeSetupInput {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string | undefined;
  webhookUrl: string;
  planPricesUsd: Partial<Record<'pro' | 'enterprise', number | undefined>>;
}

export interface StripeSetupResult {
  priceIds: Partial<Record<'pro' | 'enterprise', string>>;
  webhookConfigured: boolean;
}

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

/**
 * Validates the given Stripe key, creates/updates Product+Price objects for
 * any plan with a price supplied, auto-registers a webhook endpoint when no
 * signing secret is supplied, and persists everything to Vault (platform/stripe).
 */
export async function setupStripeIntegration(input: StripeSetupInput): Promise<StripeSetupResult> {
  const stripe = new Stripe(input.secretKey, { apiVersion: '2024-06-20', typescript: true });

  // Sanity-check the key actually works before persisting or creating anything
  await stripe.balance.retrieve();

  const priceIds: Partial<Record<'pro' | 'enterprise', string>> = {};
  for (const code of ['pro', 'enterprise'] as const) {
    const amountUsd = input.planPricesUsd[code];
    if (!amountUsd || amountUsd <= 0) continue;

    const plan = await adminDb.plan.findUnique({ where: { code } });
    if (!plan) continue;

    const product = await stripe.products.create({ name: `${plan.name} Plan` });
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: Math.round(amountUsd * 100),
      recurring: { interval: 'month' },
    });

    await adminDb.plan.update({ where: { code }, data: { priceIdStripe: price.id } });
    priceIds[code] = price.id;
  }

  let webhookSecret = input.webhookSecret?.trim() ?? '';
  if (!webhookSecret) {
    const endpoint = await stripe.webhookEndpoints.create({
      url: input.webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
    });
    webhookSecret = endpoint.secret ?? '';
  }

  await getPlatformSecrets().storeStripeKeys(input.publishableKey, input.secretKey, webhookSecret);

  return { priceIds, webhookConfigured: Boolean(webhookSecret) };
}
