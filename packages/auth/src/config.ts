import { env } from '@platform/config';
import { adminDb, redis } from '@platform/db';
import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

const ID_TOKEN_TTL = 60 * 60 * 8; // match session maxAge

export const authConfig: NextAuthConfig = {
  debug: true,
  providers: [
    KeycloakProvider({
      clientId: env.KEYCLOAK_CLIENT_ID,
      clientSecret: env.KEYCLOAK_CLIENT_SECRET,
      issuer: env.KEYCLOAK_ISSUER,
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
      if (account && profile?.sub && profile.email) {
        token.sub = profile.sub;
        token.email = profile.email;
        token.groups = (profile as Record<string, unknown>).groups ?? [];
        token.expiresAt = account.expires_at;
        // Store id_token in Redis to keep the session cookie small
        if (account.id_token) {
          await redis.set(`idtoken:${profile.sub}`, account.id_token, 'EX', ID_TOKEN_TTL);
        }
      }
      return token;
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.groups) {
        (session as unknown as Record<string, unknown>).groups = token.groups;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, profile }) {
      if (!profile?.sub || !user.email) return;
      try {
        const dbUser = await adminDb.user.upsert({
          where: { externalId: profile.sub },
          update: { email: user.email, updatedAt: new Date() },
          create: {
            externalId: profile.sub,
            email: user.email,
            status: 'ACTIVE',
          },
        });

        const groups = ((profile as Record<string, unknown>).groups as string[] | undefined) ?? [];
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
  }
}
