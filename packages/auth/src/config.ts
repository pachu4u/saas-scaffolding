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
      // Expose id_token so the federated-logout route can pass it to Keycloak
      if (token.idToken) {
        session.idToken = token.idToken as string;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, profile }) {
      if (!profile?.sub || !user.email) return;
      try {
        const dbUser = await adminDb.user.upsert({
          where: { externalId: profile.sub as string },
          update: { email: user.email, updatedAt: new Date() },
          create: {
            externalId: profile.sub as string,
            email: user.email,
            status: 'ACTIVE',
          },
        });

        // Keycloak groups claim maps to tenant slugs — JIT-provision tenant
        // membership on first login so a fresh SSO user actually lands in a
        // workspace instead of bouncing between "/" and "/dashboard" forever.
        const groups = ((profile as Record<string, unknown>)['groups'] as string[]) ?? [];
        for (const slug of groups) {
          const tenant = await adminDb.tenant.findUnique({ where: { slug } });
          if (!tenant) continue;

          await adminDb.tenantUser.upsert({
            where: { tenantId_userId: { tenantId: tenant.id, userId: dbUser.id } },
            create: { tenantId: tenant.id, userId: dbUser.id, status: 'ACTIVE' },
            update: { status: 'ACTIVE' },
          });

          const defaultRole = await adminDb.role.findFirst({ where: { name: 'tenant_user' } });
          if (defaultRole) {
            await adminDb.roleBinding.upsert({
              where: {
                tenantId_userId_roleId: {
                  tenantId: tenant.id,
                  userId: dbUser.id,
                  roleId: defaultRole.id,
                },
              },
              create: { tenantId: tenant.id, userId: dbUser.id, roleId: defaultRole.id },
              update: {},
            });
          }
        }
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
    /** OIDC id_token — used for federated logout with Keycloak */
    idToken?: string;
  }
}
