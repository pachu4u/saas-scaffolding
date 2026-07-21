import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { logger } from '@platform/logger';

import { readTenantSecretEnv, tenantInternalBaseUrl } from '../provisioning/kubernetes-driver.js';

interface SaasTarget {
  url: string;
  secret: string;
}

/**
 * Resolve where plan/usage-lock sync calls go:
 *  - kubernetes driver — the tenant's own instance, authenticated with the
 *    per-tenant secret generated at provision time
 *  - shared driver     — the single shared instance from env
 * Returns null when the tenant has no reachable instance (not provisioned yet
 * or integration unconfigured); callers treat that as a skip, matching the
 * previous shared-only behavior.
 */
async function saasTarget(tenantId: string): Promise<SaasTarget | null> {
  if (env.TENANT_STACK_DRIVER === 'kubernetes') {
    const tenant = await adminDb.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) {
      logger.warn({ tenantId }, 'Riogentix sync for missing tenant — skipping');
      return null;
    }
    const secretEnv = await readTenantSecretEnv(tenant.slug);
    const secret = secretEnv?.RIOGENTIX_SAAS_INTERNAL_SECRET;
    if (!secret) {
      logger.warn({ tenantId, slug: tenant.slug }, 'Tenant stack not provisioned — skipping sync');
      return null;
    }
    return { url: tenantInternalBaseUrl(tenant.slug), secret };
  }

  const url = env.RIOGENTIX_INTERNAL_URL;
  const secret = env.RIOGENTIX_SAAS_INTERNAL_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

async function callSaas(
  tenantId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<void> {
  const target = await saasTarget(tenantId);
  if (!target) {
    logger.debug({ path }, 'Riogentix integration not configured — skipping sync');
    return;
  }

  const res = await fetch(`${target.url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Saas-Internal-Secret': target.secret,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    // Fail fast if Riogentix is down/hung — BullMQ retries the job; an unbounded
    // fetch would instead pin the worker on a dead connection.
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${String(res.status)}: ${text}`);
  }
}

export async function syncPlan(tenantId: string, plan: string): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/plan`, { plan });
  logger.info({ tenantId, plan }, 'Synced plan to riogentix');
}

export async function setUsageLock(tenantId: string, locked: boolean): Promise<void> {
  await callSaas(tenantId, 'PUT', `/api/v1/internal/saas/tenant/${tenantId}/usage-lock`, {
    locked,
  });
  logger.info({ tenantId, locked }, 'Synced usage-lock to riogentix');
}
