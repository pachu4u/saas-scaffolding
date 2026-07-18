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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  const { tenant } = await getCurrentTenant(session.user.id);
  if (!tenant || !session.user.email) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const instance = await adminDb.connectedAppInstance.findFirst({
    where: { tenantId: tenant.tenantId, status: 'ACTIVE', app: { slug: 'riogentix' } },
  });
  if (!instance) {
    return NextResponse.redirect(
      new URL(`/t/${tenant.slug}?riogentix_error=not_provisioned`, req.url),
    );
  }

  const scimOrigin = new URL(instance.scimBaseUrl).origin;
  const token = signSsoToken(instance.scimToken, {
    email: session.user.email,
    tenant_id: tenant.tenantId,
    username: session.user.name ?? undefined,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });

  const ssoUrl = new URL(`${scimOrigin}/api/v1/internal/saas/sso`);
  ssoUrl.searchParams.set('token', token);
  ssoUrl.searchParams.set('next', '/app');

  return NextResponse.redirect(ssoUrl);
}
