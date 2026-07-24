import { env } from '@platform/config';
import { getPlatformSecrets } from '@platform/vault';
import Stripe from 'stripe';

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

let cachedConfig: StripeConfig | null = null;
let cachedClient: Stripe | null = null;

/**
 * Resolves Stripe credentials from Vault (platform/stripe), falling back to
 * STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * env vars when Vault is unreachable or unconfigured.
 */
async function getStripeConfig(): Promise<StripeConfig> {
  if (cachedConfig) return cachedConfig;

  let vaultKeys: { publishable_key: string; secret_key: string; webhook_secret: string } | null =
    null;
  try {
    vaultKeys = await getPlatformSecrets().getStripeKeys();
  } catch (err) {
    console.warn('[billing] Vault lookup for platform/stripe failed, falling back to env:', err);
  }

  cachedConfig = {
    secretKey: vaultKeys?.secret_key ?? env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: vaultKeys?.webhook_secret ?? env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: vaultKeys?.publishable_key ?? env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  };
  return cachedConfig;
}

export async function getStripeClient(): Promise<Stripe> {
  if (cachedClient) return cachedClient;
  const { secretKey } = await getStripeConfig();
  cachedClient = new Stripe(secretKey, { apiVersion: '2024-06-20', typescript: true });
  return cachedClient;
}

export async function getStripeWebhookSecret(): Promise<string> {
  const { webhookSecret } = await getStripeConfig();
  return webhookSecret;
}
