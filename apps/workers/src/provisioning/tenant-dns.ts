import { env } from '@platform/config';
import { logger } from '@platform/logger';

import { ensureTenantWildcardDns as ensureTenantWildcardDnsCloudflare } from './cloudflare-dns.js';
import { ensureTenantWildcardDns as ensureTenantWildcardDnsIonos } from './ionos-dns.js';

/**
 * Dispatches to whichever DNS provider is configured for TENANT_BASE_DOMAIN
 * (CF_DNS_API_TOKEN for a Cloudflare-hosted zone, IONOS_API_KEY for an
 * IONOS-hosted one — see packages/config/src/index.ts). Both no-op with a
 * warning if their own token is unset, so this is safe to call unconditionally.
 */
export async function ensureTenantWildcardDns(slug: string): Promise<void> {
  if (env.CF_DNS_API_TOKEN) return ensureTenantWildcardDnsCloudflare(slug);
  if (env.IONOS_API_KEY) return ensureTenantWildcardDnsIonos(slug);
  logger.warn(
    { slug },
    'Neither CF_DNS_API_TOKEN nor IONOS_API_KEY set, skipping tenant wildcard DNS record',
  );
}
