import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

import { env } from '@platform/config';
import { adminDb } from '@platform/db';

export const authConfig: NextAuthConfig = {
  debug: true,
  providers: [
    KeycloakProvider({
      clientId: env.KEYCLOAK_CLIENT_ID,
      clientSecret: env.KEYCLOAK_CLIENT_SECRET,
      issuer: env.KEYCLOAK_ISSUER,
      // In Docker, auth.lvh.me resolves to the Keycloak container IP but on
      // port 8080, not port 80. KEYCLOAK_INTERNAL_ISSUER lets us fetch the OIDC
      // discovery doc from the correct internal URL while keeping KEYCLOAK_ISSUER
      // (matching the iss claim in tokens) for validation.
      ...(env.KEYCLOAK_INTERNAL_ISSUER && {
        wellKnown: `${env.KEYCLOAK_INTERNAL_ISSUER}/.well-known/openid-configuration`,
      }),
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours
  },

  callbacks: {
    async jwt({ token, account, profile }) {
      // On first sign-in, account and profile are populated
      if (account && profile) {
        token.sub = profile.sub as string;
        token.email = profile.email as string;
        // Keycloak groups claim (mapped to tenant slugs)
        token.groups = ((profile as Record<string, unknown>)['groups'] as string[]) ?? [];
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub as string;
      }
      if (token.groups) {
        (session as unknown as Record<string, unknown>)['groups'] = token.groups;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, profile }) {
      if (!profile?.sub || !user.email) return;
      try {
        await adminDb.user.upsert({
          where: { externalId: profile.sub as string },
          update: { email: user.email, updatedAt: new Date() },
          create: {
            externalId: profile.sub as string,
            email: user.email,
            status: 'ACTIVE',
          },
        });
      } catch (err) {
        console.error('[auth] signIn event: failed to upsert user', err);
      }
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    groups: string[];
  }
}
