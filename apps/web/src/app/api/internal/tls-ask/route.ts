import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function deny() {
  return new NextResponse(null, { status: 403 });
}

/**
 * Caddy on_demand_tls "ask" endpoint (infra/compose/caddy/Caddyfile): before
 * issuing a cert for any SNI matching `app.*.TENANT_BASE_DOMAIN` /
 * `admin.*.TENANT_BASE_DOMAIN`, Caddy GETs this with `?domain=<sni>` and
 * only proceeds on a 200. Without this gate, on-demand TLS would mint a
 * real cert for ANY hostname an attacker points at the load balancer with
 * a matching SNI — this restricts issuance to `app.`/`admin.` subdomains of
 * slugs that are real, ACTIVE tenants.
 *
 * Only the two-level app./admin. hosts need this: the top-level
 * `{slug}.TENANT_BASE_DOMAIN` and `*.TENANT_BASE_DOMAIN` hosts already have
 * a static wildcard cert (see Caddyfile), and per-tenant `*.{slug}.
 * TENANT_BASE_DOMAIN` covers everything else one level deep.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase() ?? '';
  const baseDomain = env.TENANT_BASE_DOMAIN;
  if (!baseDomain || !domain) return deny();

  const match = new RegExp(
    `^(app|admin)\\.([a-z0-9-]+)\\.${baseDomain.replace(/\./g, '\\.')}$`,
  ).exec(domain);
  if (!match) return deny();

  const slug = match[2];
  if (!slug) return deny();
  const tenant = await adminDb.tenant.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: { id: true },
  });

  return tenant ? new NextResponse(null, { status: 200 }) : deny();
}
