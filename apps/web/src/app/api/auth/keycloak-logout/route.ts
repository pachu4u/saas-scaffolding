import { auth } from '@platform/auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/auth/keycloak-logout
 *
 * Federated OIDC logout: clears the Next.js session cookie then redirects
 * the browser to Keycloak's end_session_endpoint so the Keycloak SSO session
 * is also destroyed.  Without this, Keycloak silently re-authenticates the
 * user on the next SSO click even after Next.js has cleared its own cookie.
 */
export async function GET() {
  const session = await auth();
  const idToken = session?.idToken;

  const keycloakIssuer = process.env.KEYCLOAK_ISSUER ?? 'https://auth.lvh.me/realms/saas-platform';
  const appUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lvh.me';

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
  const isSecure = appUrl.startsWith('https');

  // Build Keycloak end_session URL
  const logoutUrl = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`);
  if (idToken) logoutUrl.searchParams.set('id_token_hint', idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${appUrl}/auth/signin`);
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
