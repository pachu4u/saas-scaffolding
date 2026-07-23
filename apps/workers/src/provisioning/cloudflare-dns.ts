import { env } from '@platform/config';
import { logger } from '@platform/logger';

const CF_API = 'https://api.cloudflare.com/client/v4';

interface CfDnsRecord {
  id: string;
  content: string;
  proxied: boolean;
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CF_DNS_API_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await res.json()) as { success: boolean; result: T; errors: unknown[] };
  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudflare API ${path} → ${String(res.status)}: ${JSON.stringify(body.errors)}`,
    );
  }
  return body.result;
}

let zoneIdCache: string | undefined;

async function zoneId(domain: string): Promise<string> {
  if (zoneIdCache) return zoneIdCache;
  const zones = await cfFetch<{ id: string }[]>(`/zones?name=${domain}`);
  const zone = zones[0];
  if (!zone) throw new Error(`Cloudflare zone not found for ${domain}`);
  zoneIdCache = zone.id;
  return zone.id;
}

/**
 * Cloudflare's free Universal SSL only covers the apex + one wildcard level
 * (TENANT_BASE_DOMAIN and *.TENANT_BASE_DOMAIN), so it can't terminate TLS
 * for two-level tenant hosts like app.{slug}.TENANT_BASE_DOMAIN — those fall
 * through to the proxied zone-wide wildcard, which has no cert for them
 * (ERR_SSL_VERSION_OR_CIPHER_MISMATCH). Each tenant needs its own grey-cloud
 * (unproxied) wildcard record so Traefik's own DNS-01 resolver can mint a
 * real per-SNI cert (infra/compose/traefik/traefik.yml). Before this, that
 * record was a manual, undocumented step done once for `acme` — glass and
 * globex broke on 2026-07-23 because nobody repeated it. Runs on every
 * provision (idempotent — safe on retries) instead of relying on someone
 * remembering the manual step for the next tenant.
 */
export async function ensureTenantWildcardDns(slug: string): Promise<void> {
  const domain = env.TENANT_BASE_DOMAIN;
  const ip = env.TENANT_APP_SUBDOMAIN_IP;
  if (!env.CF_DNS_API_TOKEN || !domain || !ip) {
    logger.warn(
      { slug },
      'CF_DNS_API_TOKEN/TENANT_BASE_DOMAIN/TENANT_APP_SUBDOMAIN_IP not set, skipping tenant wildcard DNS record',
    );
    return;
  }

  const name = `*.${slug}.${domain}`;
  const zone = await zoneId(domain);
  const existing = await cfFetch<CfDnsRecord[]>(`/zones/${zone}/dns_records?name=${name}&type=A`);
  const record = existing[0];

  if (record) {
    if (record.content === ip && !record.proxied) {
      logger.info({ slug }, 'Tenant wildcard DNS record already correct');
      return;
    }
    await cfFetch(`/zones/${zone}/dns_records/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: ip, proxied: false }),
    });
    logger.info({ slug }, 'Updated tenant wildcard DNS record');
    return;
  }

  await cfFetch(`/zones/${zone}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'A',
      name,
      content: ip,
      ttl: 300,
      proxied: false,
      comment: `grey-cloud: 2nd-level ${slug} subdomains, needs Traefik DNS-01 cert`,
    }),
  });
  logger.info({ slug, name }, 'Created tenant wildcard DNS record');
}
