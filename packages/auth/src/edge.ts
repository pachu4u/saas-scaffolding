import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

// Derive the shared cookie domain so the Edge middleware uses the same cookie
// names/scope as the Node.js runtime (config.ts). Without this, the middleware
// would look for `authjs.session-token` while the server sets
// `__Secure-authjs.session-token; Domain=.techhanker.com` and auth would break.
const edgeAuthUrlHost = (() => {
  try {
    return process.env.AUTH_URL ? new URL(process.env.AUTH_URL).hostname : '';
  } catch {
    return '';
  }
})();
const edgeIsSecure = !!process.env.AUTH_URL?.startsWith('https');
const edgeCookieDomain = edgeAuthUrlHost.includes('.')
  ? '.' + edgeAuthUrlHost.split('.').slice(-2).join('.')
  : undefined;
const edgeSessionCookieName = edgeIsSecure
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

const edgeSharedCookieOptions = edgeCookieDomain
  ? {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure: edgeIsSecure,
      domain: edgeCookieDomain,
    }
  : undefined;

// Edge-compatible auth config — no Node.js-only imports (@platform/db, ioredis, Prisma).
// Used exclusively by middleware.ts which runs on the Edge runtime.
export const edgeAuthConfig: NextAuthConfig = {
  ...(process.env.AUTH_SECRET ? { secret: process.env.AUTH_SECRET } : {}),
  ...(edgeSharedCookieOptions
    ? {
        cookies: {
          sessionToken: { name: edgeSessionCookieName, options: edgeSharedCookieOptions },
          callbackUrl: { options: edgeSharedCookieOptions },
          pkceCodeVerifier: { options: edgeSharedCookieOptions },
          state: { options: edgeSharedCookieOptions },
          nonce: { options: edgeSharedCookieOptions },
        },
      }
    : {}),
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? '',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
      issuer: process.env.KEYCLOAK_ISSUER ?? '',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // NextAuth's callback type requires a Promise return even though this
    // implementation has no real await.
    // eslint-disable-next-line @typescript-eslint/require-await
    async jwt({ token, account, profile }) {
      if (account && profile?.sub && profile.email) {
        token.sub = profile.sub;
        token.email = profile.email;
        token.groups = (profile as Record<string, unknown>).groups ?? [];
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.groups) (session as unknown as Record<string, unknown>).groups = token.groups;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
