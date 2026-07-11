import { env } from '@platform/config';
import { logger } from '@platform/logger';

import type { PlanCode } from './plans.js';

async function riogentixFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<void> {
  if (!env.RIOGENTIX_INTERNAL_URL) return;

  const url = `${env.RIOGENTIX_INTERNAL_URL}${path}`;
  const bodyJson = body !== undefined ? JSON.stringify(body) : undefined;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': env.RIOGENTIX_INTERNAL_SECRET ?? '',
    },
    ...(bodyJson !== undefined && { body: bodyJson }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix ${method} ${path} failed: ${String(res.status)} ${text}`);
  }
}

export async function provisionTenant(tenantId: string, plan: PlanCode): Promise<void> {
  if (!env.RIOGENTIX_INTERNAL_URL) return;
  try {
    await riogentixFetch('POST', `/internal/tenant/${tenantId}/provision`, { plan });
    logger.info({ tenantId, plan }, 'Riogentix tenant provisioned');
  } catch (err) {
    logger.error({ tenantId, plan, err }, 'Riogentix provisionTenant failed');
    throw err;
  }
}

export async function updateTenantPlan(tenantId: string, plan: PlanCode): Promise<void> {
  if (!env.RIOGENTIX_INTERNAL_URL) return;
  try {
    await riogentixFetch('PUT', `/internal/tenant/${tenantId}/plan`, { plan });
    logger.info({ tenantId, plan }, 'Riogentix tenant plan updated');
  } catch (err) {
    logger.error({ tenantId, plan, err }, 'Riogentix updateTenantPlan failed');
    throw err;
  }
}

export async function setUsageLock(tenantId: string, locked: boolean): Promise<void> {
  if (!env.RIOGENTIX_INTERNAL_URL) return;
  try {
    await riogentixFetch('PUT', `/internal/tenant/${tenantId}/usage-lock`, { locked });
    logger.info({ tenantId, locked }, 'Riogentix usage lock updated');
  } catch (err) {
    logger.error({ tenantId, locked, err }, 'Riogentix setUsageLock failed');
    throw err;
  }
}
