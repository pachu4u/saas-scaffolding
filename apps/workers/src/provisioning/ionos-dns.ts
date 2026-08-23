import { env } from '@platform/config';
import { logger } from '@platform/logger';

const IONOS_API = 'https://api.hosting.ionos.com/dns/v1';

interface IonosRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  disabled: boolean;
}

async function ionosFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${IONOS_API}${path}`, {
    ...init,
    headers: {
      'X-API-Key': env.IONOS_API_KEY ?? '',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IONOS DNS API ${path} → ${String(res.status)}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let zoneIdCache: string | undefined;

async function zoneId(domain: string): Promise<string> {
  if (zoneIdCache) return zoneIdCache;
  const zones = await ionosFetch<{ id: string; name: string }[]>('/zones');
  const zone = zones.find((z) => z.name === domain);
  if (!zone) throw new Error(`IONOS zone not found for ${domain}`);
  zoneIdCache = zone.id;
  return zone.id;
}

async function ensureARecord(zone: string, name: string, ip: string): Promise<void> {
  const existing = await ionosFetch<{ records: IonosRecord[] }>(
    `/zones/${zone}?recordName=${encodeURIComponent(name)}&recordType=A`,
  );
  const record = existing.records.find((r) => r.name === name && r.type === 'A');

  if (record) {
    if (record.content === ip && !record.disabled) {
      logger.info({ name }, 'Tenant DNS record already correct');
      return;
    }
    await ionosFetch(`/zones/${zone}/records/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, type: 'A', content: ip, ttl: 300, disabled: false }),
    });
    logger.info({ name }, 'Updated tenant DNS record');
    return;
  }

  await ionosFetch(`/zones/${zone}/records`, {
    method: 'POST',
    body: JSON.stringify([{ name, type: 'A', content: ip, ttl: 300, disabled: false }]),
  });
  logger.info({ name }, 'Created tenant DNS record');
}

/**
 * IONOS equivalent of cloudflare-dns.ts's ensureTenantWildcardDns — same
 * rationale (each tenant needs its own wildcard A record so Traefik's DNS-01
 * resolver can mint a per-SNI cert for two-level tenant hosts). IONOS has no
 * "proxied" concept (that's Cloudflare-specific), so this is just a plain A
 * record create/update, idempotent on every provision.
 *
 * Also ensures the bare `{slug}.{domain}` record itself, which the Ingress
 * routes as the tenant's primary host. Relying on the zone's own top-level
 * `*.{domain}` wildcard to cover it doesn't work: creating `*.{slug}.{domain}`
 * implicitly creates a zone node at `{slug}.{domain}` (the wildcard's own
 * parent), and per RFC 4592 a wildcard only synthesizes answers for names
 * that don't otherwise exist in the zone -- so once the second-level
 * wildcard exists, `{slug}.{domain}` stops matching the parent wildcard and
 * returns NODATA instead. Found via test-corporation-3.riogentix.com
 * resolving NODATA while app.test-corporation-3.riogentix.com worked fine,
 * 2026-08-24.
 */
export async function ensureTenantWildcardDns(slug: string): Promise<void> {
  const domain = env.TENANT_BASE_DOMAIN;
  const ip = env.TENANT_APP_SUBDOMAIN_IP;
  if (!env.IONOS_API_KEY || !domain || !ip) {
    logger.warn(
      { slug },
      'IONOS_API_KEY/TENANT_BASE_DOMAIN/TENANT_APP_SUBDOMAIN_IP not set, skipping tenant wildcard DNS record',
    );
    return;
  }

  const zone = await zoneId(domain);
  await ensureARecord(zone, `${slug}.${domain}`, ip);
  await ensureARecord(zone, `*.${slug}.${domain}`, ip);
}
