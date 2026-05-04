import { NextResponse } from 'next/server';

import { auth } from '@platform/auth';

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'https://app.lvh.me';

  // Build Keycloak end_session URL
  const logoutUrl = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`);
  if (idToken) logoutUrl.searchParams.set('id_token_hint', idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${appUrl}/auth/signin`);
  logoutUrl.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID ?? 'saas-platform');

  const response = NextResponse.redirect(logoutUrl);

  // Clear the Next.js / auth.js session cookies.
  // next-auth v5 uses __Secure- prefix on HTTPS, plain name on HTTP.
  const cookieOptions = {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
  };
  response.cookies.set('authjs.session-token', '', cookieOptions);
  response.cookies.set('__Secure-authjs.session-token', '', {
    ...cookieOptions,
    secure: true,
  });
  response.cookies.set('authjs.csrf-token', '', cookieOptions);
  response.cookies.set('__Host-authjs.csrf-token', '', {
    ...cookieOptions,
    secure: true,
  });
  response.cookies.set('authjs.callback-url', '', cookieOptions);
  response.cookies.set('__Secure-authjs.callback-url', '', {
    ...cookieOptions,
    secure: true,
  });

  return response;
}
