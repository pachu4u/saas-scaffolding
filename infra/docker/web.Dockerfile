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
ARG NEXT_PUBLIC_APP_URL
ARG DATABASE_URL
ARG DATABASE_URL_MIGRATOR
ARG KEYCLOAK_ISSUER
ARG KEYCLOAK_CLIENT_ID
ARG KEYCLOAK_CLIENT_SECRET
ARG AUTH_SECRET
ARG AUTH_URL
ARG REDIS_URL
ARG PLATFORM_INTERNAL_SECRET
ENV GIT_SHA=${GIT_SHA}
ENV NEXT_TELEMETRY_DISABLED=1

# Set environment variables for build-time validation
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV DATABASE_URL_MIGRATOR=${DATABASE_URL_MIGRATOR}
ENV KEYCLOAK_ISSUER=${KEYCLOAK_ISSUER}
ENV KEYCLOAK_CLIENT_ID=${KEYCLOAK_CLIENT_ID}
ENV KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV AUTH_URL=${AUTH_URL}
ENV REDIS_URL=${REDIS_URL}
ENV PLATFORM_INTERNAL_SECRET=${PLATFORM_INTERNAL_SECRET}

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages

# Generate the Prisma client before building packages — @platform/logger (audit.ts)
# and others import types from @platform/db, so the client must exist first.
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

# openssl1.1-compat provides libssl.so.1.1 as a fallback for Prisma query engine
RUN apk add --no-cache openssl openssl1.1-compat ca-certificates 2>/dev/null || apk add --no-cache openssl ca-certificates

# Trust the mkcert dev CA so Node.js undici (fetch) can reach https://auth.lvh.me.
# NODE_EXTRA_CA_CERTS only works for the legacy https module; undici reads from
# OpenSSL's system trust store, which update-ca-certificates populates.
COPY infra/compose/traefik/certs/mkcert-rootCA.pem /usr/local/share/ca-certificates/mkcert-rootCA.crt
RUN update-ca-certificates

# Non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy node_modules and packages first (needed for prisma generate)
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/packages ./packages

# Generate Prisma client in the runner stage where OpenSSL 1.1 compat is available
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm --filter @platform/db db:generate

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
