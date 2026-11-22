import { getStripeClient } from '@platform/billing';
import { adminDb } from '@platform/db';
import { getPlatformSecrets } from '@platform/vault';

/**
 * Monthly plan prices as Stripe actually charges them. Prices are created in
 * Stripe by the admin Billing setup and linked via plans.price_id_stripe, so
 * Stripe is the only source of truth for revenue numbers. Replaces a
 * hardcoded { pro: 49, enterprise: 999 } table that never matched anything.
 */

export interface PlanPrice {
  /** Price normalised to one month, in major currency units (e.g. dollars). */
  monthly: number;
  currency: string;
  priceId: string;
}

export interface PlanPrices {
  stripeConfigured: boolean;
  prices: Record<string, PlanPrice>;
  /** Plans linked to a Stripe price we couldn't read, with the reason. */
  errors: Record<string, string>;
}

const PER_MONTH: Record<string, number> = { day: 30, week: 52 / 12, month: 1, year: 1 / 12 };

async function isStripeConfigured(): Promise<boolean> {
  const keys = await getPlatformSecrets()
    .getStripeKeys()
    .catch(() => null);
  return Boolean(keys?.secret_key ?? process.env.STRIPE_SECRET_KEY);
}

export async function getPlanPrices(): Promise<PlanPrices> {
  const [stripeConfigured, plans] = await Promise.all([
    isStripeConfigured(),
    adminDb.plan.findMany({ select: { code: true, priceIdStripe: true } }),
  ]);

  const prices: Record<string, PlanPrice> = {};
  const errors: Record<string, string> = {};
  const linked = plans.filter((p) => p.priceIdStripe);
  if (!stripeConfigured || linked.length === 0) return { stripeConfigured, prices, errors };

  const stripe = await getStripeClient();
  await Promise.all(
    linked.map(async ({ code, priceIdStripe }) => {
      const priceId = priceIdStripe ?? '';
      try {
        const price = await stripe.prices.retrieve(priceId);
        const interval = price.recurring?.interval ?? 'month';
        const count = price.recurring?.interval_count ?? 1;
        const perMonth = (PER_MONTH[interval] ?? 1) / count;
        prices[code] = {
          monthly: ((price.unit_amount ?? 0) / 100) * perMonth,
          currency: price.currency.toUpperCase(),
          priceId,
        };
      } catch (err) {
        errors[code] = err instanceof Error ? err.message.slice(0, 160) : 'unknown error';
      }
    }),
  );
  return { stripeConfigured, prices, errors };
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
