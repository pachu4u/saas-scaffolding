import { adminDb } from '@platform/db';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fixed oauth2-proxy callback host (see docker-compose.yml); also the only
// host registered in the oauth2-proxy client's post-logout redirect URIs.
const OAUTH_PROXY_HOST = process.env.OAUTH_PROXY_HOST ?? 'oauthproxy.techhanker.com';

function deny() {
  return new NextResponse(null, { status: 403 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 403 page shown (via Traefik forwardAuth) when a logged-in user opens a
// tenant they don't belong to. Without this the user is stuck: the
// oauth2-proxy cookie keeps them "logged in", so every retry is another
// bare 403 with no way to switch accounts. The switch-account link chains
// oauth2-proxy sign-out -> Keycloak logout -> fresh login -> back here.
function denyPage(email: string, host: string) {
  const issuer = process.env.KEYCLOAK_ISSUER ?? '';
  const backToTenant = `https://${OAUTH_PROXY_HOST}/oauth2/sign_in?rd=${encodeURIComponent(`https://${host}/`)}`;
  const keycloakLogout = `${issuer}/protocol/openid-connect/logout?client_id=oauth2-proxy&post_logout_redirect_uri=${encodeURIComponent(backToTenant)}`;
  const switchAccountUrl = `https://${host}/oauth2/sign_out?rd=${encodeURIComponent(keycloakLogout)}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Access denied</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 2.5rem; max-width: 26rem; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  h1 { font-size: 1.25rem; margin: 0 0 .75rem; }
  p { color: #475569; font-size: .9rem; line-height: 1.5; margin: 0 0 1.5rem; }
  a.btn { display: inline-block; background: #0f172a; color: #fff; text-decoration: none;
          padding: .6rem 1.25rem; border-radius: 8px; font-size: .9rem; }
</style>
</head>
<body>
<div class="card">
  <h1>You don&rsquo;t have access to ${escapeHtml(host)}</h1>
  <p>You&rsquo;re signed in as <strong>${escapeHtml(email)}</strong>, which is not a member of this
     workspace. Ask a workspace admin for an invite, or sign in with a different account.</p>
  <a class="btn" href="${escapeHtml(switchAccountUrl)}">Sign out &amp; switch account</a>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// Called by Traefik forwardAuth (after tenant-auth/oauth2-proxy has authenticated
// the user). Verifies that the authenticated user is an active member of the
// specific tenant subdomain they're accessing.
//
// Headers set by Traefik / prior middlewares:
//   X-Authz-Secret     — injected by the add-authz-secret Traefik headers middleware;
//                        must match PLATFORM_INTERNAL_SECRET to prevent direct calls
//   X-Auth-Request-Email — set by oauth2-proxy (authResponseHeaders) with the
//                          verified email of the authenticated user
//   X-Auth-Request-Groups — comma-separated Keycloak groups of the user
//   X-Forwarded-Host   — the original Host header (e.g. "acme.techhanker.com")
async function handler(req: NextRequest) {
  const secret = req.headers.get('x-authz-secret');
  if (!process.env.PLATFORM_INTERNAL_SECRET || secret !== process.env.PLATFORM_INTERNAL_SECRET) {
    return deny();
  }

  const email = req.headers.get('x-auth-request-email');
  if (!email) {
    return deny();
  }

  // Note: Platform admins are intentionally NOT allowed here. They should
  // access admin functionality via the /admin routes on the platform domain,
  // not tenant subdomains.

  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const host = forwardedHost.split(':')[0]?.toLowerCase() ?? '';
  const slug = host.split('.')[0] ?? '';
  if (!slug) {
    return deny();
  }

  try {
    const member = await adminDb.tenantUser.findFirst({
      where: {
        status: 'ACTIVE',
        user: { email },
        tenant: { slug, status: 'ACTIVE' },
      },
      select: { tenantId: true },
    });

    return member ? new NextResponse(null, { status: 200 }) : denyPage(email, host);
  } catch (err) {
    console.error('[tenant-authz]', err);
    return new NextResponse(null, { status: 500 });
  }
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
