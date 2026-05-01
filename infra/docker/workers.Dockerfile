# syntax=docker/dockerfile:1.9
ARG NODE_VERSION=20

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/logger/package.json ./packages/logger/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/billing/package.json ./packages/billing/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM deps AS builder
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

COPY tsconfig.base.json ./
COPY apps/workers ./apps/workers
COPY packages ./packages

RUN pnpm --filter @platform/db db:generate
RUN pnpm --filter @platform/config build
RUN pnpm --filter @platform/logger build
RUN pnpm --filter @platform/db build
RUN pnpm --filter @platform/jobs build
RUN pnpm --filter @platform/notifications build
RUN pnpm --filter @platform/billing build
RUN pnpm --filter @platform/workers build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/packages ./packages

CMD ["apps/workers/dist/index.js"]
