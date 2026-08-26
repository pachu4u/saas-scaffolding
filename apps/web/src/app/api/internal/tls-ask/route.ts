import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function deny() {
  return new NextResponse(null, { status: 403 });
}

/**
 * Caddy on_demand_tls "ask" endpoint (infra/compose/caddy/Caddyfile): before
 * issuing a cert for any on-demand SNI, Caddy GETs this with `?domain=<sni>`
 * and only proceeds on a 200. Without this gate, on-demand TLS would mint a
 * real cert for ANY hostname an attacker points at the load balancer with a
 * matching SNI.
 *
 * Covers three shapes: the fixed platform hostnames (saas./auth./
 * oauthproxy., not tenant-derived, always allowed), the bare `{slug}.
 * TENANT_BASE_DOMAIN` tenant host (matches the `*.TENANT_BASE_DOMAIN` block),
 * and the two-level `app.`/`admin.{slug}.TENANT_BASE_DOMAIN` hosts (matches
 * the `:443` catch-all block) -- both of the latter two require `slug` to be
 * a real, ACTIVE tenant.
 *
 * All three moved onto on-demand TLS (rather than a static wildcard cert
 * for the first two, and Caddy's normally-eager automatic HTTPS for the
 * fixed hostnames) after a from-scratch VM rebuild (2026-08-26) had no
 * static cert to fall back on and eager issuance for the named hosts
 * silently never attempted at all (no error, no log line -- root cause not
 * identified under time pressure during the live outage this caused).
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase() ?? '';
  const baseDomain = env.TENANT_BASE_DOMAIN;
  if (!baseDomain || !domain) return deny();

  if (
    domain === `saas.${baseDomain}` ||
    domain === `auth.${baseDomain}` ||
    domain === `oauthproxy.${baseDomain}`
  ) {
    return new NextResponse(null, { status: 200 });
  }

  const escapedBase = baseDomain.replace(/\./g, '\\.');
  const match = new RegExp(`^(?:(app|admin)\\.)?([a-z0-9-]+)\\.${escapedBase}$`).exec(domain);
  if (!match) return deny();

  const slug = match[2];
  if (!slug) return deny();
  const tenant = await adminDb.tenant.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: { id: true },
  });

  return tenant ? new NextResponse(null, { status: 200 }) : deny();
}
