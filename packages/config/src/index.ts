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

  // Riogentix integration
  RIOGENTIX_INTERNAL_URL: z.string().url().optional(),
  RIOGENTIX_SAAS_INTERNAL_SECRET: z.string().min(16).optional(),
  RIOGENTIX_INTERNAL_SECRET: z.string().min(16).optional(),
  RIOGENTIX_PUBLIC_URL: z.string().url().optional(),

  // Per-tenant stack provisioning (Kubernetes driver)
  // 'shared'    — legacy behavior: one shared Riogentix instance, provisioning is
  //               an HTTP upsert against RIOGENTIX_INTERNAL_URL (local dev default)
  // 'kubernetes'— stamp a dedicated Riogentix stack per tenant into the cluster
  TENANT_STACK_DRIVER: z.enum(['shared', 'kubernetes']).default('shared'),
  // Public wildcard domain tenants live under, e.g. 'techhanker.com'
  // → tenant ingress host becomes '<slug>.techhanker.com'
  TENANT_BASE_DOMAIN: z.string().optional(),
  TENANT_NAMESPACE_PREFIX: z.string().default('t-'),
  TENANT_INGRESS_CLASS: z.string().default('nginx'),
  // cert-manager ClusterIssuer for per-tenant TLS; when unset the ingress
  // relies on a wildcard cert terminated at the ingress controller
  TENANT_CERT_MANAGER_ISSUER: z.string().optional(),
  // Pinned Riogentix image stamped out per tenant, e.g. registry/riogentix:1.4.2
  RIOGENTIX_IMAGE: z.string().optional(),
  RIOGENTIX_CONTAINER_PORT: z.coerce.number().default(8000),
  TENANT_POD_CPU_LIMIT: z.string().default('1'),
  TENANT_POD_MEMORY_LIMIT: z.string().default('1Gi'),
  // Superuser connection to the shared Postgres server used to create the
  // per-tenant database + role (e.g. STACKIT PostgreSQL Flex admin URL)
  TENANT_PG_ADMIN_URL: z.string().optional(),
  // Hostname pods use to reach that Postgres server, when it differs from the
  // host in TENANT_PG_ADMIN_URL (defaults to the admin URL's host:port)
  TENANT_PG_HOST_FOR_PODS: z.string().optional(),
  // Only the in-cluster workers Deployment (saas-platform/saas-workers) has a
  // path to the k3s API (via its own ServiceAccount/ClusterRoleBinding) — an
  // external `workers` process has no kubeconfig and would fail every
  // tenant-provision/deprovision job it happened to pick up. Set to 'false'
  // there so those two queues are only ever consumed by the pod that can
  // actually act on them.
  WORKER_ENABLE_TENANT_PROVISIONING: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Keycloak admin (for user creation during signup)
  KEYCLOAK_INTERNAL_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string().default('saas-platform'),
  KEYCLOAK_ADMIN_USERNAME: z.string().optional(),
  KEYCLOAK_ADMIN_PASSWORD: z.string().optional(),

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
  return result.data;
}

export const env = parseEnv();
export type { Env };
