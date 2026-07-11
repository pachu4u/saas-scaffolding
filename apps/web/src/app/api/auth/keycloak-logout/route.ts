import { auth } from '@platform/auth';
import { redis } from '@platform/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  // id_token is stored in Redis (not the session cookie) to keep cookie size small
  const idToken = session?.user?.id ? await redis.get(`idtoken:${session.user.id}`) : null;

  const keycloakIssuer = process.env.KEYCLOAK_ISSUER ?? 'https://auth.lvh.me/realms/saas-platform';
  const appUrl =
    process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const logoutUrl = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`);
  if (idToken) logoutUrl.searchParams.set('id_token_hint', idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${appUrl}/auth/signin`);
  logoutUrl.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID ?? 'saas-platform');

  const response = NextResponse.redirect(logoutUrl);

  const cookieOptions = {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
  };
  response.cookies.set('authjs.session-token', '', cookieOptions);
  response.cookies.set('__Secure-authjs.session-token', '', { ...cookieOptions, secure: true });
  response.cookies.set('authjs.csrf-token', '', cookieOptions);
  response.cookies.set('__Host-authjs.csrf-token', '', { ...cookieOptions, secure: true });
  response.cookies.set('authjs.callback-url', '', cookieOptions);
  response.cookies.set('__Secure-authjs.callback-url', '', { ...cookieOptions, secure: true });

  return response;
}
