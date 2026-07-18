# syntax=docker/dockerfile:1.9
ARG NODE_VERSION=20

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
# Install OpenSSL 3.x which is compatible with Prisma query engine on Alpine 3.23
RUN apk add --no-cache openssl
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/logger/package.json ./packages/logger/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/billing/package.json ./packages/billing/
COPY packages/scim/package.json ./packages/scim/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM deps AS builder
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

COPY tsconfig.base.json ./
COPY apps/workers ./apps/workers
COPY packages ./packages

# Remove stale linux-musl (OpenSSL 1.1) engine so prisma generate downloads
# the correct linux-musl-openssl-3.0.x engine for Alpine
RUN find /app/node_modules -name "libquery_engine-linux-musl.so.node" -delete 2>/dev/null || true
RUN pnpm --filter @platform/db db:generate
RUN pnpm --filter @platform/config build
RUN pnpm --filter @platform/db build
RUN pnpm --filter @platform/logger build
RUN pnpm --filter @platform/jobs build
RUN pnpm --filter @platform/notifications build
RUN pnpm --filter @platform/billing build
RUN pnpm --filter @platform/scim build
RUN pnpm --filter @platform/workers build

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
# Copy directly from builder. The deps stage already limits node_modules to only
# workers' transitive dependencies — the image is already lean.
#
# We must copy node_modules from builder (not deps) because builder ran
# prisma generate which adds .prisma/client/ into node_modules.
#
# pnpm workspace symlinks in node_modules resolve back to /app/packages/* so we
# also need each package's package.json (for conditional exports) and dist/.
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# openssl1.1-compat provides libssl.so.1.1 as a fallback for any cached Prisma
# engine that was compiled against OpenSSL 1.1 (until the pnpm cache refreshes).
# Alpine 3.23 uses OpenSSL 3.x; the runner stage needs openssl only
RUN apk add --no-cache openssl

# node_modules — includes Prisma generated client, BullMQ, ioredis, etc.
COPY --from=builder /app/node_modules ./node_modules

# Workspace package stubs — pnpm symlinks resolve to /app/packages/* at runtime.
# Each package needs: package.json (conditional exports), dist/ (compiled output),
# and node_modules/ (pnpm puts package-level deps there, as symlinks into root .pnpm/).
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/config/node_modules ./packages/config/node_modules

COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules

COPY --from=builder /app/packages/logger/package.json ./packages/logger/package.json
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/logger/node_modules ./packages/logger/node_modules

COPY --from=builder /app/packages/jobs/package.json ./packages/jobs/package.json
COPY --from=builder /app/packages/jobs/dist ./packages/jobs/dist
COPY --from=builder /app/packages/jobs/node_modules ./packages/jobs/node_modules

COPY --from=builder /app/packages/notifications/package.json ./packages/notifications/package.json
COPY --from=builder /app/packages/notifications/dist ./packages/notifications/dist
COPY --from=builder /app/packages/notifications/node_modules ./packages/notifications/node_modules

COPY --from=builder /app/packages/billing/package.json ./packages/billing/package.json
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/packages/billing/node_modules ./packages/billing/node_modules

COPY --from=builder /app/packages/scim/package.json ./packages/scim/package.json
COPY --from=builder /app/packages/scim/dist ./packages/scim/dist
COPY --from=builder /app/packages/scim/node_modules ./packages/scim/node_modules

# Workers app: compiled output, package.json, and app-level node_modules
# (bullmq lives here as a symlink into root .pnpm/ virtual store)
COPY --from=builder /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/apps/workers/package.json ./apps/workers/package.json

# Root package.json (pnpm workspace marker)
COPY --from=builder /app/package.json ./package.json

CMD ["node", "apps/workers/dist/index.js"]
