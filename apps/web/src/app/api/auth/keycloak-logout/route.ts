import { env } from '@platform/config';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/auth/keycloak-logout
 *
 * Federated OIDC logout: clears the Next.js session cookie then redirects
 * the browser to Keycloak's end_session_endpoint so the Keycloak SSO session
 * is also destroyed.  Without this, Keycloak silently re-authenticates the
 * user on the next SSO click even after Next.js has cleared its own cookie.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lvh.me';
  const isSecure = appUrl.startsWith('https');
  // Read id_token straight off the encrypted session JWT rather than the
  // client-visible session object — it's never exposed to the browser.
  const token = await getToken({
    req,
    secret: env.AUTH_SECRET,
    secureCookie: isSecure,
  });
  const idToken = typeof token?.idToken === 'string' ? token.idToken : undefined;

  const keycloakIssuer = process.env.KEYCLOAK_ISSUER ?? 'https://auth.lvh.me/realms/saas-platform';

  // Prefer the origin the user came from (e.g. demo.techhanker.com) so they
  // land back on their tenant's branded sign-in page after logout.
  const referer = req.headers.get('referer');
  const postLogoutBase = (() => {
    if (referer) {
      try {
        return new URL(referer).origin;
      } catch {
        // ignore
      }
    }
    return appUrl.replace(/\/$/, '');
  })();

  // Derive shared cookie domain (e.g. ".techhanker.com") — must match what authConfig.ts
  // used when setting the session cookie, otherwise Set-Cookie with maxAge=0 won't clear it.
  const authHost = (() => {
    try {
      return new URL(appUrl).hostname;
    } catch {
      return '';
    }
  })();
  const cookieDomain = authHost.includes('.')
    ? '.' + authHost.split('.').slice(-2).join('.')
    : undefined;

  // Optional return path (e.g. an /invite/{token} link) to send the user back
  // to after they sign back in — otherwise they'd land on the default signin
  // page and lose it. Only ever a relative path, never an absolute URL, so
  // this can't be used to redirect off-site.
  const returnTo = new URL(req.url).searchParams.get('returnTo');
  const signInPath =
    returnTo?.startsWith('/') && !returnTo.startsWith('//')
      ? `/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`
      : '/auth/signin';

  // Build Keycloak end_session URL
  const logoutUrl = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`);
  if (idToken) logoutUrl.searchParams.set('id_token_hint', idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${postLogoutBase}${signInPath}`);
  logoutUrl.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID ?? 'saas-platform');

  const response = NextResponse.redirect(logoutUrl);

  // Base options shared across most cookies. Domain must be included so the browser
  // removes the cookie that was originally set with domain=.techhanker.com.
  const base = {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  response.cookies.set('authjs.session-token', '', base);
  response.cookies.set('__Secure-authjs.session-token', '', { ...base, secure: true });
  response.cookies.set('authjs.callback-url', '', base);
  response.cookies.set('__Secure-authjs.callback-url', '', { ...base, secure: true });

  // __Host- cookies forbid the domain attribute by spec; clear without it.
  const hostCookieOpts = {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
  };
  response.cookies.set('authjs.csrf-token', '', base);
  response.cookies.set('__Host-authjs.csrf-token', '', hostCookieOpts);

  return response;
}
