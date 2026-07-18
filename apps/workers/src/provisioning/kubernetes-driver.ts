import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import * as k8s from '@kubernetes/client-node';
import { env } from '@platform/config';
import { logger } from '@platform/logger';

import { ensureTenantDatabase, tenantDatabaseUrl } from './database.js';
import { DEPLOYMENT_NAME, SECRET_NAME, SERVICE_NAME, renderTenantManifests } from './manifests.js';
import type { ProvisionOutcome, TenantRef, TenantStackDriver, TenantStackSpec } from './types.js';

const FIELD_MANAGER = 'saas-provisioner';
const READY_TIMEOUT_MS = 10 * 60_000;
const READY_POLL_MS = 5_000;

let kubeConfig: k8s.KubeConfig | undefined;

function kc(): k8s.KubeConfig {
  if (!kubeConfig) {
    kubeConfig = new k8s.KubeConfig();
    // In-cluster service account when running inside the cluster, otherwise
    // $KUBECONFIG / ~/.kube/config — same resolution kubectl uses.
    kubeConfig.loadFromDefault();
  }
  return kubeConfig;
}

export function tenantNamespace(slug: string): string {
  return `${env.TENANT_NAMESPACE_PREFIX}${slug}`;
}

/**
 * Cluster-internal base URL for a tenant's Riogentix instance. Used for the
 * post-deploy provision call and for later plan/usage-lock sync calls.
 */
export function tenantInternalBaseUrl(slug: string): string {
  return `http://${SERVICE_NAME}.${tenantNamespace(slug)}.svc.cluster.local`;
}

function isNotFound(err: unknown): boolean {
  return err instanceof k8s.ApiException && err.code === 404;
}

function requireEnv(
  name: 'TENANT_BASE_DOMAIN' | 'RIOGENTIX_IMAGE' | 'TENANT_PG_ADMIN_URL',
): string {
  const value = env[name];
  if (!value) {
    throw new Error(`TENANT_STACK_DRIVER=kubernetes requires ${name} to be set`);
  }
  return value;
}

/**
 * Credentials live in the tenant's Secret, which is the source of truth so
 * that retries reuse the same generated values instead of rotating them
 * mid-provision (the database role password must match the Secret). Also used
 * by riogentix-client to authenticate plan/usage-lock sync calls against the
 * tenant's instance.
 */
export async function readTenantSecretEnv(slug: string): Promise<Record<string, string> | null> {
  const namespace = tenantNamespace(slug);
  const core = kc().makeApiClient(k8s.CoreV1Api);
  try {
    const secret = await core.readNamespacedSecret({ name: SECRET_NAME, namespace });
    return Object.fromEntries(
      Object.entries(secret.data ?? {}).map(([key, value]) => [
        key,
        Buffer.from(value, 'base64').toString('utf8'),
      ]),
    );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function buildSpec(tenant: TenantRef): Promise<TenantStackSpec> {
  const baseDomain = requireEnv('TENANT_BASE_DOMAIN');
  const image = requireEnv('RIOGENTIX_IMAGE');
  const pgAdminUrl = requireEnv('TENANT_PG_ADMIN_URL');

  const namespace = tenantNamespace(tenant.slug);
  const existing = await readTenantSecretEnv(tenant.slug);
  const dbPassword = existing?.TENANT_DB_PASSWORD ?? randomBytes(24).toString('base64url');
  const internalSecret =
    existing?.RIOGENTIX_INTERNAL_SECRET ?? randomBytes(24).toString('base64url');
  const saasSecret =
    existing?.RIOGENTIX_SAAS_INTERNAL_SECRET ?? randomBytes(24).toString('base64url');

  // Converge role password to the Secret's value (create DB/role on first run)
  await ensureTenantDatabase(pgAdminUrl, tenant.slug, dbPassword);

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    plan: tenant.plan,
    namespace,
    host: `${tenant.slug}.${baseDomain}`,
    image,
    containerPort: env.RIOGENTIX_CONTAINER_PORT,
    ingressClassName: env.TENANT_INGRESS_CLASS,
    ...(env.TENANT_CERT_MANAGER_ISSUER && {
      certManagerIssuer: env.TENANT_CERT_MANAGER_ISSUER,
    }),
    cpuLimit: env.TENANT_POD_CPU_LIMIT,
    memoryLimit: env.TENANT_POD_MEMORY_LIMIT,
    // Contract with the Riogentix image — injected via envFrom on the pod.
    // The image reads RIOGENTIX_DATABASE_URL (see lfx settings/groups/database.py),
    // not DATABASE_URL — a bare DATABASE_URL silently falls back to sqlite.
    secretEnv: {
      RIOGENTIX_DATABASE_URL: tenantDatabaseUrl(
        pgAdminUrl,
        tenant.slug,
        dbPassword,
        env.TENANT_PG_HOST_FOR_PODS,
      ),
      TENANT_DB_PASSWORD: dbPassword,
      RIOGENTIX_INTERNAL_SECRET: internalSecret,
      RIOGENTIX_SAAS_INTERNAL_SECRET: saasSecret,
      SAAS_TENANT_ID: tenant.id,
      SAAS_TENANT_SLUG: tenant.slug,
      SAAS_PLAN: tenant.plan,
      // Role assignments synced from the console are only enforced when the
      // instance's authorization layer is on.
      RIOGENTIX_AUTHZ_ENABLED: 'true',
      PORT: String(env.RIOGENTIX_CONTAINER_PORT),
    },
  };
}

async function applyManifests(spec: TenantStackSpec): Promise<void> {
  const objectApi = k8s.KubernetesObjectApi.makeApiClient(kc());
  for (const manifest of renderTenantManifests(spec)) {
    // Server-side apply: creates the object when missing, otherwise converges
    // it to the rendered state — one idempotent verb for both paths.
    await objectApi.patch(
      manifest,
      undefined,
      undefined,
      FIELD_MANAGER,
      true,
      k8s.PatchStrategy.ServerSideApply,
    );
  }
}

async function waitForDeploymentReady(namespace: string): Promise<void> {
  const apps = kc().makeApiClient(k8s.AppsV1Api);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const deployment = await apps.readNamespacedDeployment({ name: DEPLOYMENT_NAME, namespace });
    if ((deployment.status?.readyReplicas ?? 0) >= 1) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Deployment ${namespace}/${DEPLOYMENT_NAME} not ready after ${String(READY_TIMEOUT_MS / 1000)}s`,
      );
    }
    await sleep(READY_POLL_MS);
  }
}

/** Upsert the tenant inside its own freshly-deployed instance. */
async function provisionInstanceTenant(spec: TenantStackSpec): Promise<void> {
  // buildSpec always populates this; the Record index type can't express that
  const internalSecret = spec.secretEnv.RIOGENTIX_INTERNAL_SECRET ?? '';
  const res = await fetch(
    `${tenantInternalBaseUrl(spec.slug)}/internal/tenant/${spec.tenantId}/provision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
      },
      body: JSON.stringify({ plan: spec.plan, slug: spec.slug }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix instance provision → ${String(res.status)}: ${text}`);
  }
}

export const kubernetesDriver: TenantStackDriver = {
  name: 'kubernetes',

  async provision(tenant: TenantRef): Promise<ProvisionOutcome> {
    const spec = await buildSpec(tenant);
    logger.info({ tenantId: tenant.id, namespace: spec.namespace }, 'Applying tenant stack');
    await applyManifests(spec);
    await waitForDeploymentReady(spec.namespace);
    await provisionInstanceTenant(spec);
    logger.info({ tenantId: tenant.id, host: spec.host }, 'Tenant stack ready');
    const scimToken = spec.secretEnv.RIOGENTIX_SAAS_INTERNAL_SECRET ?? '';
    return {
      publicUrl: `https://${spec.host}`,
      scimEndpoint: {
        baseUrl: `${tenantInternalBaseUrl(spec.slug)}/api/v1/scim/v2/tenants/${spec.tenantId}`,
        token: scimToken,
      },
    };
  },

  async deprovision(tenant): Promise<void> {
    const core = kc().makeApiClient(k8s.CoreV1Api);
    const namespace = tenantNamespace(tenant.slug);
    try {
      // Deleting the namespace tears down everything in it. The tenant's
      // database is intentionally retained for offboarding/export.
      await core.deleteNamespace({ name: namespace });
      logger.info({ tenantId: tenant.id, namespace }, 'Tenant namespace deleted');
    } catch (err) {
      if (!isNotFound(err)) throw err;
      logger.info({ tenantId: tenant.id, namespace }, 'Tenant namespace already absent');
    }
  },
};
