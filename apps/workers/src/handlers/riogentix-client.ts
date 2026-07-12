import { env } from '@platform/config';
import { logger } from '@platform/logger';

function baseUrl(): string | null {
  return env.RIOGENTIX_INTERNAL_URL ?? null;
}

function saasSecret(): string | null {
  return env.RIOGENTIX_SAAS_INTERNAL_SECRET ?? null;
}

function internalSecret(): string | null {
  return env.RIOGENTIX_INTERNAL_SECRET ?? null;
}

async function callSaas(method: string, path: string, body?: unknown): Promise<void> {
  const url = baseUrl();
  const sec = saasSecret();

  if (!url || !sec) {
    logger.debug({ path }, 'Riogentix integration not configured — skipping sync');
    return;
  }

  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Saas-Internal-Secret': sec,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${res.status}: ${text}`);
  }
}

async function callInternal(method: string, path: string, body?: unknown): Promise<Response> {
  const url = baseUrl();
  const sec = internalSecret();

  if (!url || !sec) {
    logger.debug({ path }, 'Riogentix internal API not configured — skipping');
    throw new Error('Riogentix internal API not configured');
  }

  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': sec,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res;
}

export async function provisionTenant(tenantId: string, plan: string): Promise<void> {
  await callInternal('POST', `/internal/tenant/${tenantId}/provision`, { plan });
  logger.info({ tenantId, plan }, 'Provisioned tenant in riogentix');
}

export async function syncPlan(tenantId: string, plan: string): Promise<void> {
  await callSaas('PUT', `/api/v1/internal/saas/tenant/${tenantId}/plan`, { plan });
  logger.info({ tenantId, plan }, 'Synced plan to riogentix');
}

export async function setUsageLock(tenantId: string, locked: boolean): Promise<void> {
  await callSaas('PUT', `/api/v1/internal/saas/tenant/${tenantId}/usage-lock`, { locked });
  logger.info({ tenantId, locked }, 'Synced usage-lock to riogentix');
}
