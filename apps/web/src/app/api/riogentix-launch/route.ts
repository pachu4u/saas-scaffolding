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
 * never needs to know them), and redirects on to /app. Riogentix's /app and
 * /api/v1 paths are routed straight to the tenant's instance at the edge
 * (see riogentix-tenants.yml), bypassing this app entirely from there on.
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

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
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

  const token = signSsoToken(instance.scimToken, {
    email: session.user.email,
    tenant_id: tenant.tenantId,
    username: session.user.name ?? undefined,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });

  // The SSO endpoint is reached through the same public tenant origin the
  // browser is already on (Traefik routes /api/v1 there — see
  // riogentix-tenants.yml), not instance.scimBaseUrl, which is a
  // cluster-internal address unreachable from outside.
  const ssoUrl = new URL(`${origin}/api/v1/internal/saas/sso`);
  ssoUrl.searchParams.set('token', token);
  ssoUrl.searchParams.set('next', '/app');

  return NextResponse.redirect(ssoUrl);
}
