import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

// Edge-compatible auth config — no Node.js-only imports (@platform/db, ioredis, Prisma).
// Used exclusively by middleware.ts which runs on the Edge runtime.
export const edgeAuthConfig: NextAuthConfig = {
  ...(process.env['AUTH_SECRET'] ? { secret: process.env['AUTH_SECRET'] } : {}),
  providers: [
    KeycloakProvider({
      clientId: process.env['KEYCLOAK_CLIENT_ID'] ?? '',
      clientSecret: process.env['KEYCLOAK_CLIENT_SECRET'] ?? '',
      issuer: process.env['KEYCLOAK_ISSUER'] ?? '',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = profile.sub as string;
        token.email = profile.email as string;
        token.groups = ((profile as Record<string, unknown>)['groups'] as string[]) ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub as string;
      if (token.groups) (session as unknown as Record<string, unknown>)['groups'] = token.groups;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
