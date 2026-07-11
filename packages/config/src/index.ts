import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // App
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATOR: z.string().min(1).optional(),

  // Keycloak
  KEYCLOAK_ISSUER: z.string().url(),
  // Optional internal URL for OIDC discovery (used in Docker where the public
  // hostname alias routes directly to Keycloak on a non-standard port).
  // When set, the discovery doc is fetched from this URL; token iss validation
  // still uses KEYCLOAK_ISSUER which must match the issuer in the discovery doc.
  KEYCLOAK_INTERNAL_ISSUER: z.string().url().optional(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),

  // Auth.js
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('saas-platform'),

  // Internal
  PLATFORM_INTERNAL_SECRET: z.string().min(16),

  // Riogentix (optional — only required when Riogentix is deployed)
  RIOGENTIX_INTERNAL_URL: z.string().url().optional(),
  RIOGENTIX_INTERNAL_SECRET: z.string().min(16).optional(),

  // Git
  GIT_SHA: z.string().default('dev'),

  // HashiCorp Vault
  VAULT_ADDR: z.string().url().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_ROLE_ID: z.string().optional(),
  VAULT_SECRET_ID: z.string().optional(),
  VAULT_NAMESPACE: z.string().optional(),
  VAULT_MOUNT_PATH: z.string().default('secret'),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables — check .env');
  }
  const data = result.data;

  // Both Riogentix vars must be set together or not at all
  const hasUrl = data.RIOGENTIX_INTERNAL_URL !== undefined;
  const hasSecret = data.RIOGENTIX_INTERNAL_SECRET !== undefined;
  if (hasUrl !== hasSecret) {
    throw new Error(
      'RIOGENTIX_INTERNAL_URL and RIOGENTIX_INTERNAL_SECRET must both be set or both be unset',
    );
  }

  return data;
}

export const env = parseEnv();
export type { Env };
