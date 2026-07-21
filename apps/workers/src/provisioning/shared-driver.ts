import { env } from '@platform/config';
import { logger } from '@platform/logger';

import type { ProvisionOutcome, TenantStackDriver } from './types.js';

/**
 * Legacy topology: one shared Riogentix instance for every tenant.
 * Provisioning is an idempotent tenant upsert against its internal API; when
 * the integration isn't configured (bare local dev) it's a successful no-op,
 * matching the previous inline behavior in the web routes.
 */
export const sharedDriver: TenantStackDriver = {
  name: 'shared',

  async provision(tenant): Promise<ProvisionOutcome> {
    const url = env.RIOGENTIX_INTERNAL_URL;
    const secret = env.RIOGENTIX_INTERNAL_SECRET;
    if (!url || !secret) {
      logger.debug({ tenantId: tenant.id }, 'Riogentix integration not configured — skipping');
      return { publicUrl: null, scimEndpoint: null };
    }

    const res = await fetch(`${url}/internal/tenant/${tenant.id}/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({ plan: tenant.plan, slug: tenant.slug }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Riogentix provision failed (${String(res.status)}): ${text}`);
    }

    const scimToken = env.RIOGENTIX_SAAS_INTERNAL_SECRET;
    return {
      publicUrl: null,
      scimEndpoint: scimToken
        ? { baseUrl: `${url}/api/v1/scim/v2/tenants/${tenant.id}`, token: scimToken }
        : null,
    };
  },

  deprovision(tenant): Promise<void> {
    // Shared instance keeps the tenant rows; nothing to tear down.
    logger.info({ tenantId: tenant.id }, 'Shared driver deprovision: no-op');
    return Promise.resolve();
  },
};
