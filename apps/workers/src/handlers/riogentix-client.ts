import { env } from '@platform/config';
import { logger } from '@platform/logger';

function baseUrl(): string | null {
  return env.RIOGENTIX_INTERNAL_URL ?? null;
}

function secret(): string | null {
  return env.RIOGENTIX_SAAS_INTERNAL_SECRET ?? null;
}

async function call(method: string, path: string, body?: unknown): Promise<void> {
  const url = baseUrl();
  const sec = secret();

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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Riogentix API ${method} ${path} → ${res.status}: ${text}`);
  }
}

export async function syncPlan(tenantId: string, plan: string): Promise<void> {
  await call('PUT', `/api/v1/internal/saas/tenant/${tenantId}/plan`, { plan });
  logger.info({ tenantId, plan }, 'Synced plan to riogentix');
}

export async function setUsageLock(tenantId: string, locked: boolean): Promise<void> {
  await call('PUT', `/api/v1/internal/saas/tenant/${tenantId}/usage-lock`, { locked });
  logger.info({ tenantId, locked }, 'Synced usage-lock to riogentix');
}
