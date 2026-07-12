import { env } from '@platform/config';
import { adminDb } from '@platform/db';
import type { NextAuthConfig } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

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
    // Allow post-login redirects to any subdomain of the root domain (e.g. tenant.techhanker.com).
    // NextAuth v5 blocks cross-origin redirectTo by default; this whitelists *.rootdomain only.
    // eslint-disable-next-line @typescript-eslint/require-await
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url);
        const base = new URL(baseUrl);
        const parts = base.hostname.split('.');
        // Root domain = last two labels (works for .com, .io, etc.)
        const rootDomain = parts.slice(-2).join('.');
        if (target.hostname === base.hostname || target.hostname.endsWith('.' + rootDomain)) {
          return url;
        }
      } catch {
        // url may be a relative path — allow it
        if (url.startsWith('/')) return `${baseUrl}${url}`;
      }
      return baseUrl;
    },

    // NextAuth's callback type requires a Promise return even though this
    // implementation has no real await.
    // eslint-disable-next-line @typescript-eslint/require-await
    async jwt({ token, account, profile }) {
      // On first sign-in, account and profile are populated
      if (account && profile?.sub && profile.email) {
        token.sub = profile.sub;
        token.email = profile.email;
        // Keycloak groups claim (mapped to tenant slugs)
        token.groups = (profile as Record<string, unknown>).groups ?? [];
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
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
        // Try to find the user by their real Keycloak ID first. If not found,
        // look up by email — this handles self-serve signups where the DB user
        // was created with a `pending-<uuid>` externalId before the first login.
        let dbUser = await adminDb.user.findUnique({ where: { externalId: profile.sub } });
        if (!dbUser) {
          const emailUser = await adminDb.user.findUnique({
            where: { email: user.email.toLowerCase() },
          });
          if (emailUser) {
            // Claim the pending user record so their tenant memberships are visible.
            dbUser = await adminDb.user.update({
              where: { id: emailUser.id },
              data: { externalId: profile.sub, updatedAt: new Date() },
            });
          } else {
            dbUser = await adminDb.user.create({
              data: {
                externalId: profile.sub,
                email: user.email.toLowerCase(),
                status: 'ACTIVE',
              },
            });
          }
        } else {
          dbUser = await adminDb.user.update({
            where: { id: dbUser.id },
            data: { email: user.email.toLowerCase(), updatedAt: new Date() },
          });
        }

        // Keycloak groups claim maps to tenant slugs — JIT-provision tenant
        // membership on first login so a fresh SSO user actually lands in a
        // workspace instead of bouncing between "/" and "/dashboard" forever.
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
    /** OIDC id_token — used for federated logout with Keycloak */
    idToken?: string;
  }
}
