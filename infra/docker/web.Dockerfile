# syntax=docker/dockerfile:1.9
ARG NODE_VERSION=20

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/authz/package.json ./packages/authz/
COPY packages/billing/package.json ./packages/billing/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/logger/package.json ./packages/logger/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/observability/package.json ./packages/observability/
COPY packages/scim/package.json ./packages/scim/
COPY packages/tenant/package.json ./packages/tenant/
COPY packages/ui/package.json ./packages/ui/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM deps AS builder
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
ENV NEXT_TELEMETRY_DISABLED=1

# next build statically collects route page data, which imports @platform/config —
# its zod schema validates process.env eagerly at import time. These placeholders
# only need to satisfy that schema; docker-compose's env_file/environment override
# them at container runtime (see the runner stage's .env removal step below).
ENV NEXT_PUBLIC_APP_URL=https://app.lvh.me
ENV DATABASE_URL=postgresql://app:app@localhost:5432/saas_platform
ENV KEYCLOAK_ISSUER=https://auth.lvh.me/realms/saas-platform
ENV KEYCLOAK_CLIENT_ID=web
ENV KEYCLOAK_CLIENT_SECRET=build-time-placeholder
ENV AUTH_SECRET=build-time-placeholder-32-characters-min
ENV AUTH_URL=https://app.lvh.me
ENV REDIS_URL=redis://localhost:6379
ENV PLATFORM_INTERNAL_SECRET=build-time-placeholder

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages

# Generate Prisma client — remove any stale cached engines first so binaryTargets
# in schema.prisma (linux-musl-openssl-3.0.x) are honoured on Alpine.
# Remove the stale linux-musl (OpenSSL 1.1) engine from installed node_modules.
# Alpine 3.17+ uses OpenSSL 3.0 → prisma generate will download
# libquery_engine-linux-musl-openssl-3.0.x which is what the runner needs.
RUN find /app/node_modules -name "libquery_engine-linux-musl.so.node" -delete 2>/dev/null || true
RUN pnpm --filter @platform/db db:generate

# Build packages first (dependency order)
RUN pnpm --filter @platform/config build
RUN pnpm --filter @platform/db build
RUN pnpm --filter @platform/logger build
RUN pnpm --filter @platform/jobs build
RUN pnpm --filter @platform/tenant build
RUN pnpm --filter @platform/authz build
RUN pnpm --filter @platform/auth build
RUN pnpm --filter @platform/billing build
RUN pnpm --filter @platform/scim build
RUN pnpm --filter @platform/notifications build
RUN pnpm --filter @platform/observability build
RUN pnpm --filter @platform/ui build
RUN pnpm --filter @platform/web build
# Ensure public dir exists so the runner COPY doesn't fail
RUN mkdir -p /app/apps/web/public

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
# Use node:alpine instead of distroless — gives us wget for healthcheck and
# avoids PATH issues with the Prisma engine binary.
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Next.js standalone server binds to HOSTNAME — 0.0.0.0 makes it reachable on all interfaces
# (including localhost) so Docker healthcheck wget can connect.
ENV HOSTNAME=0.0.0.0

# openssl1.1-compat provides libssl.so.1.1 as a fallback for any cached Prisma
# engine that was compiled against OpenSSL 1.1 (until the pnpm cache refreshes).
RUN apk add --no-cache openssl openssl1.1-compat ca-certificates 2>/dev/null || apk add --no-cache openssl ca-certificates

# Trust the mkcert dev CA so Node.js undici (fetch) can reach https://auth.lvh.me.
# NODE_EXTRA_CA_CERTS only works for the legacy https module; undici reads from
# OpenSSL's system trust store, which update-ca-certificates populates.
COPY infra/compose/traefik/certs/mkcert-rootCA.pem /usr/local/share/ca-certificates/mkcert-rootCA.crt
RUN update-ca-certificates

# Non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public

# Remove any baked-in .env files — Docker environment variables must win at runtime.
# Next.js standalone copies .env from the build context; if left in place, they
# override process.env set by docker-compose (e.g. DATABASE_URL pointing to localhost).
RUN find /app -name ".env" -o -name ".env.local" -o -name ".env.production" | xargs rm -f 2>/dev/null || true

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
