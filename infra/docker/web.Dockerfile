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

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages

# Generate Prisma client
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
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["apps/web/server.js"]
