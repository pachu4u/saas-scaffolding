import { createHmac } from 'node:crypto';

import { auth } from '@platform/auth';
import { adminDb } from '@platform/db';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentTenant } from '@/lib/server-tenant';

const TOKEN_TTL_SECONDS = 60;

/**
 * SSO bridge: signs a short-lived HMAC token (same scheme and secret as the
 * ConnectedAppInstance SCIM bearer token) and redirects the browser straight
 * to Riogentix's GET /api/v1/internal/saas/sso, which verifies it, creates a
 * session, sets its own access_token_lf/refresh_token_lf cookies (with
 * whatever cookie domain/security settings it's configured with — this app
 * never needs to know them), and redirects on to app.{slug}.techhanker.com,
 * Riogentix's dedicated root host. That host and /api/v1 on the base tenant
 * origin are both routed straight to the tenant's instance at the edge (see
 * tenant-app-admin-subdomains.yml and riogentix-tenants.yml), bypassing this
 * app entirely from there on.
 */
function signSsoToken(secret: string, payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * `req.url` reflects the internal Node bind address (e.g. 0.0.0.0:3000)
 * behind Traefik, not the public tenant hostname the browser is on — using
 * it for a redirect target sends the browser to an address it can't resolve.
 * The Host header (forwarded as-is by Traefik) is the reliable source, same
 * pattern middleware.ts uses for tenant routing.
 */
function publicOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

/**
 * admin.{slug}.techhanker.com (see tenant-app-admin-subdomains.yml +
 * middleware.ts's extractSlug) only routes to this web app, not to
 * Riogentix's /api/v1 — so building the SSO/app URLs from that host 404s.
 * Strip the `admin.` label to get back to the tenant's base host, which is
 * the one Traefik actually wires to Riogentix.
 */
function canonicalTenantOrigin(origin: string): string {
  const url = new URL(origin);
  const labels = url.hostname.split('.');
  if (labels[0] === 'admin' && labels.length > 3) {
    url.hostname = labels.slice(1).join('.');
  }
  return url.origin;
}

/**
 * `app.{host}` origin, e.g. https://app.acme.techhanker.com — Riogentix's
 * own dedicated root host (see renderIngress in manifests.ts and
 * tenant-app-admin-subdomains.yml), as opposed to `{host}/app` on the base
 * tenant origin.
 */
function appOrigin(origin: string): string {
  const url = new URL(origin);
  url.hostname = `app.${url.hostname}`;
  return url.origin;
}

export async function GET(req: NextRequest) {
  const origin = canonicalTenantOrigin(publicOrigin(req));
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/auth/signin', origin));
  }

  const { tenant } = await getCurrentTenant(session.user.id);
  if (!tenant || !session.user.email) {
    return NextResponse.redirect(new URL('/', origin));
  }

  const instance = await adminDb.connectedAppInstance.findFirst({
    where: { tenantId: tenant.tenantId, status: 'ACTIVE', app: { slug: 'riogentix' } },
  });
  if (!instance) {
    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}?riogentix_error=not_provisioned`, origin),
    );
  }

  // The user's native Riogentix role (viewer/developer/admin) — mirrored into
  // app-scoped Role rows by the app-sync worker, see /admin/team/roles/page.tsx
  // — travels in the SSO token so Riogentix's header can show it without a
  // second round trip. Riogentix stashes it in optins.saas_role on login.
  const userRecord = await adminDb.user.findUnique({
    where: { externalId: session.user.id },
    select: {
      roleBindings: {
        where: {
          tenantId: tenant.tenantId,
          role: { tenantId: null, appId: instance.appId, isSystem: true },
        },
        select: { role: { select: { name: true } } },
      },
    },
  });
  const role = userRecord?.roleBindings[0]?.role.name;

  const token = signSsoToken(instance.scimToken, {
    email: session.user.email,
    tenant_id: tenant.tenantId,
    username: session.user.name ?? undefined,
    role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });

  // The SSO endpoint is reached through the same public tenant origin the
  // browser is already on (Traefik routes /api/v1 there — see
  // riogentix-tenants.yml), not instance.scimBaseUrl, which is a
  // cluster-internal address unreachable from outside.
  const ssoUrl = new URL(`${origin}/api/v1/internal/saas/sso`);
  ssoUrl.searchParams.set('token', token);
  ssoUrl.searchParams.set('next', `${appOrigin(origin)}/`);

  return NextResponse.redirect(ssoUrl);
}
