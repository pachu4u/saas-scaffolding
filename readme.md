# riogentix — Enterprise SaaS Platform

A production-ready, multi-tenant SaaS scaffolding that eliminates months of boilerplate. Ships with SSO, RBAC, billing, webhooks, audit logging, SCIM provisioning, async workers, full observability, and a complete admin console — all pre-wired and running locally via Docker in one command.

---

## Objective

Most SaaS teams spend 3–6 months rebuilding the same infrastructure before writing a single line of product code. riogentix is that infrastructure, production-grade from day one:

- **Multi-tenancy** via subdomain routing + Postgres Row-Level Security
- **Enterprise auth** (SSO/OIDC via Keycloak, SCIM 2.0 provisioning)
- **Fine-grained RBAC** with a pluggable permission engine
- **Billing** with Stripe (Checkout, Customer Portal, webhook handling)
- **Async job engine** with BullMQ + Redis (retries, DLQ, idempotency)
- **Full observability** (OpenTelemetry traces, structured logs, Grafana dashboards)
- **Platform admin console** to manage tenants, users, jobs, and revenue

The goal: clone, configure your domain and Stripe keys, and ship your product.

---

## Tech Stack

| Layer             | Technology                                                       |
| ----------------- | ---------------------------------------------------------------- |
| **Framework**     | Next.js 15 (App Router, React Server Components, Server Actions) |
| **Language**      | TypeScript 5.5 throughout                                        |
| **Auth**          | Auth.js v5 (next-auth) + Keycloak 24 (OIDC/SAML)                 |
| **Database**      | PostgreSQL 16 with Prisma 5 ORM + Row-Level Security             |
| **Cache / Jobs**  | Redis 7 + BullMQ                                                 |
| **Billing**       | Stripe (Checkout, Customer Portal, webhooks)                     |
| **Email**         | Resend (swappable via `@platform/notifications`)                 |
| **Reverse proxy** | Traefik v3 (TLS termination, subdomain routing)                  |
| **Observability** | OpenTelemetry → Collector → Prometheus + Loki + Tempo + Grafana  |
| **Monorepo**      | pnpm workspaces + Turborepo                                      |
| **Containers**    | Docker Compose (dev) + Helm charts (production Kubernetes)       |
| **Linting / CI**  | ESLint, Prettier, Husky, commitlint, GitHub Actions              |

---

## Architecture

```
Browser
  │
  ▼
Traefik v3 (TLS termination, *.lvh.me wildcard cert)
  ├── auth.lvh.me  ──► Keycloak 24 (OIDC / SAML / SCIM IdP)
  ├── app.lvh.me   ─┐
  ├── acme.lvh.me  ─┤
  └── *.lvh.me     ─┴► Next.js 15 (App Router)
                          │
                          ├── Middleware: extracts tenant slug from host
                          │             sets x-tenant-slug header
                          │
                          ├── (dashboard) routes — tenant workspace
                          │     Auth.js session required
                          │     Tenant resolved via slug → RLS scoped
                          │
                          ├── (admin) routes — platform admin console
                          │     Requires platform_super_admin group in JWT
                          │
                          └── /api/* — REST endpoints
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             PostgreSQL 16              Redis 7
          (RLS + Prisma ORM)        (BullMQ queues +
            3 DB roles:              tenant cache +
            app / migrator /         authz cache)
            platform_admin                │
                                          ▼
                                    BullMQ Workers
                                  (email, webhooks,
                                   usage rollup,
                                   plan changes)
```

### Multi-tenancy Model

Every tenant gets a subdomain (`acme.lvh.me`). The middleware extracts the slug from the `Host` header and injects `x-tenant-slug`. All database queries run under Postgres **Row-Level Security** — the `app` role can only see rows matching `current_setting('app.tenant_id')`. Platform-admin operations use `withPlatformAdmin()` which sets `ROLE platform_admin` (BYPASSRLS) inside a transaction.

### Auth Flow

1. User visits `app.lvh.me/auth/signin` → clicks **Continue with SSO**
2. Auth.js redirects to Keycloak → OIDC authorization code flow
3. Keycloak issues JWT; Auth.js stores `sub`, `email`, `groups`, `id_token` in an encrypted session cookie
4. `session.groups` contains Keycloak group memberships (e.g. `platform_super_admin`)
5. Dashboard layout checks groups → platform admins redirect to `/admin`
6. Sign-out hits `/api/auth/keycloak-logout` — clears the Next.js cookie **and** calls Keycloak's `end_session_endpoint` with `id_token_hint` (full federated logout)

---

## Project Structure

```
saas-scaffolding/
├── apps/
│   ├── web/                        # Next.js 15 application
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (admin)/        # Platform admin routes
│   │       │   │   └── admin/
│   │       │   │       ├── page.tsx          # Overview
│   │       │   │       ├── tenants/          # Tenant management
│   │       │   │       ├── users/            # User directory
│   │       │   │       ├── jobs/             # BullMQ inspector
│   │       │   │       └── revenue/          # Revenue dashboard
│   │       │   ├── (dashboard)/    # Tenant workspace routes
│   │       │   │   ├── dashboard/            # Home / metrics
│   │       │   │   ├── billing/              # Subscription management
│   │       │   │   ├── team/                 # Members + roles
│   │       │   │   ├── audit/                # Audit log viewer
│   │       │   │   ├── webhooks/             # Webhook endpoints
│   │       │   │   └── settings/             # General, branding, security, API keys
│   │       │   ├── api/            # API route handlers
│   │       │   │   ├── auth/                 # Auth.js + keycloak-logout
│   │       │   │   ├── admin/                # jobs, users
│   │       │   │   ├── billing/              # checkout, portal, webhook
│   │       │   │   ├── team/                 # invite, accept
│   │       │   │   ├── settings/             # general, branding, security
│   │       │   │   ├── webhooks/             # CRUD + deliveries
│   │       │   │   ├── tenants/              # list + create
│   │       │   │   ├── usage/                # usage events
│   │       │   │   └── users/me              # profile
│   │       │   └── auth/           # Sign-in page
│   │       ├── components/
│   │       │   ├── layout/         # Sidebar, Topbar, InnerNav, WorkspaceSwitcher
│   │       │   ├── modals/         # InviteModal
│   │       │   ├── team/           # InviteButton
│   │       │   ├── admin/          # CreateTenantButton
│   │       │   └── ui/             # Badge, etc.
│   │       └── middleware.ts       # Auth guard + tenant slug injection
│   └── workers/                    # BullMQ worker process
│       └── src/index.ts            # Queue processors
│
├── packages/
│   ├── auth/                       # Auth.js config + Keycloak provider
│   ├── authz/                      # RBAC engine (can, hasEntitlement)
│   ├── billing/                    # Stripe client + plan registry
│   ├── config/                     # Zod-validated env schema
│   ├── db/                         # Prisma schema, client helpers, seed
│   ├── jobs/                       # BullMQ queue definitions
│   ├── logger/                     # pino logger + audit logging
│   ├── notifications/              # Email abstraction (Resend)
│   ├── observability/              # OTel SDK instrumentation
│   ├── scim/                       # SCIM 2.0 Users + Groups handlers
│   ├── tenant/                     # Subdomain resolver + tenant context
│   └── ui/                         # Shared React components + theme
│
└── infra/
    ├── compose/
    │   ├── docker-compose.yml              # Core services
    │   ├── docker-compose.observability.yml # OTel, Prometheus, Loki, Tempo, Grafana
    │   └── docker-compose.tools.yml        # Mailpit, Stripe CLI, pgAdmin
    ├── docker/
    │   ├── web.Dockerfile          # 3-stage Next.js standalone build
    │   └── workers.Dockerfile      # 3-stage workers build
    ├── helm/saas-platform/         # Kubernetes Helm chart
    ├── keycloak/realm-export.json  # Keycloak realm + client config
    ├── postgres/init/              # DB role creation SQL
    └── observability/              # OTel, Prometheus, Loki, Tempo, Grafana config
```

---

## Features & Capabilities

### Authentication & Identity

- **SSO via Keycloak** — OIDC authorization code flow, JWT session (8h)
- **Federated logout** — clears both the Next.js cookie and the Keycloak session via `end_session_endpoint` + `id_token_hint`
- **Platform admin vs tenant user** — role determined by Keycloak group membership (`platform_super_admin`, `platform_support`); layouts auto-redirect accordingly
- **Keycloak realm** pre-configured with `saas-platform` realm, `web` client, groups-to-claim mapper

### Multi-tenancy

- **Subdomain routing** — `{slug}.lvh.me` in dev; configurable for production
- **Postgres RLS** — `FORCE ROW LEVEL SECURITY` on all tenant tables; `app` role only sees its own rows; `platform_admin` bypasses via `BYPASSRLS`
- **Tenant isolation helpers** — `withTenant(tenantId, fn)` sets the RLS session var; `withPlatformAdmin(fn)` runs as the privileged role
- **Tenant suspension** — suspended tenants are redirected to `/suspended` at the layout level

### RBAC (Role-Based Access Control)

- **Six system roles**: `platform_super_admin`, `platform_support`, `tenant_admin`, `tenant_billing_admin`, `tenant_user`, `tenant_viewer`
- **Permission engine** (`@platform/authz`) — `can(ctx, permission)` with Redis-cached role bindings (120s TTL)
- **Entitlement checks** — `hasEntitlement(tenantId, feature)` reads plan feature flags (e.g. `scim.enabled`, `webhooks.enabled`, `users.max`)
- **Plan-gated features**: Free (5 users, no SCIM/webhooks), Pro (50 users, SCIM + webhooks), Enterprise (unlimited + custom domains)

### Billing (Stripe)

- **Stripe Checkout** — `POST /api/billing/checkout` creates a hosted checkout session
- **Customer Portal** — `POST /api/billing/portal` opens Stripe-hosted subscription management
- **Webhook handler** — `POST /api/billing/webhook` (public, HMAC-verified) handles `customer.subscription.*` and `invoice.*` events idempotently
- **Plan registry** — `@platform/billing/plans` defines Free / Pro / Enterprise with feature flags and Stripe price IDs

### Team Management

- **Member invite flow** — email-based with HMAC-signed token (7-day expiry); `POST /api/team/invite` + accept endpoint
- **Role assignment** — invite API assigns system role by name (`tenant_user`, `tenant_admin`, etc.) with RLS bypass
- **SCIM 2.0** — `@platform/scim` implements `/scim/Users` and `/scim/Groups` for automated provisioning from Okta, Entra ID, and any compliant IdP

### Tenant Settings

- **General** — workspace name, timezone (`PATCH /api/settings/general`)
- **Branding** — logo URL, primary colour, custom CSS (`PATCH /api/settings/branding`)
- **Security & SSO** — SCIM token management, SSO domain enforcement (`GET/PATCH /api/settings/security`)
- **API Keys** — tenant-scoped API key management

### Webhooks

- **Endpoint management** — create, update, delete webhook endpoints with per-event filters
- **Delivery tracking** — `WebhookDelivery` records every attempt; history at `/api/webhooks/[id]/deliveries`
- **Retry queue** — failed deliveries re-enqueued in `webhookOutboundQueue` with exponential backoff

### Async Job Engine (BullMQ)

- **Queues**: `emailQueue`, `webhookInboundQueue`, `webhookOutboundQueue`, `usageRollupQueue`, `planChangedQueue`
- **Retry policy** — 5 attempts, exponential backoff (1s base), DLQ for dead jobs
- **Idempotency** — `enqueue()` accepts `idempotencyKey`; deduplicates by BullMQ job ID
- **Admin inspector** — `/admin/jobs` shows queue depths and DLQ entries

### Audit Logging

- **Immutable audit trail** — `AuditLog` table with `action`, `resourceType`, `resourceId`, `before/after` JSON diffs, IP, and user agent
- **Viewer** — `/audit` page with filterable audit event list

### Observability

- **OpenTelemetry** — traces exported to OTel Collector → Tempo; metrics → Prometheus; logs → Loki
- **Grafana** — pre-provisioned with Prometheus, Loki, and Tempo datasources at `grafana.lvh.me`
- **Structured logging** — pino with `request_id`, `tenant_id`, `user_id` fields on every log
- **Health endpoint** — `GET /api/health` for liveness probes (Docker healthcheck + Kubernetes)

### Platform Admin Console

- **Overview** — live counts: total tenants, users, active jobs, DLQ size; plan distribution; recent tenants
- **Tenant management** — list all tenants, view detail (members, audit events), suspend / reinstate, create new tenant
- **User directory** — cross-tenant user search
- **Job inspector** — BullMQ queue and DLQ browser
- **Revenue dashboard** — Stripe revenue overview

---

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x
- [mkcert](https://github.com/FiloSottile/mkcert) (local TLS certificates)
- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)

### 1 — Generate TLS certificates

```bash
mkcert -install                        # trust the local CA in your OS / browser
cd infra/compose/traefik/certs
mkcert "*.lvh.me" lvh.me              # generates _wildcard.lvh.me.pem + key
# Copy the root CA so the web container can trust Keycloak's TLS:
cp "$(mkcert -CAROOT)/rootCA.pem" mkcert-rootCA.pem
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Minimum required changes for local dev:

| Variable                             | What to set                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                        | Any 32+ character random string                                                                    |
| `KEYCLOAK_CLIENT_SECRET`             | Must match the secret in `infra/keycloak/realm-export.json` (default: `change-me-keycloak-secret`) |
| `STRIPE_SECRET_KEY`                  | Your Stripe test secret key (`sk_test_...`)                                                        |
| `STRIPE_WEBHOOK_SECRET`              | From `stripe listen` output (`whsec_...`)                                                          |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Your Stripe test publishable key (`pk_test_...`)                                                   |
| `RESEND_API_KEY`                     | Resend API key — or leave as placeholder, dev email goes to Mailpit                                |
| `PLATFORM_INTERNAL_SECRET`           | Any 16+ character random string                                                                    |

All other variables default correctly for local Docker Compose.

### 3 — Start the stack

```bash
# Core services only (recommended to start)
pnpm dev:up

# Core + observability (adds OTel, Prometheus, Loki, Tempo, Grafana)
docker compose \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.observability.yml \
  up -d

# Full stack (adds Mailpit, Stripe CLI, pgAdmin)
docker compose \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.observability.yml \
  -f infra/compose/docker-compose.tools.yml \
  up -d
```

Wait ~60 seconds for Keycloak to initialise on first run, then visit **https://app.lvh.me**.

### 4 — Demo credentials

| User              | Password   | Role                   | Access                      |
| ----------------- | ---------- | ---------------------- | --------------------------- |
| `alice@acme.test` | `alice123` | `tenant_user`          | Acme tenant workspace       |
| `bob@globex.test` | `bob123`   | `tenant_user`          | Globex tenant workspace     |
| `platform-admin`  | `admin123` | `platform_super_admin` | Platform admin console      |
| `admin`           | `admin`    | Keycloak admin         | Keycloak admin console only |

> To manage Keycloak users and passwords: https://auth.lvh.me/admin (log in as `admin / admin`).

---

## Local URLs

All services are available over HTTPS via Traefik + the mkcert wildcard certificate.

| URL                    | Service                  | Credentials               |
| ---------------------- | ------------------------ | ------------------------- |
| https://app.lvh.me     | Main application         | SSO                       |
| https://acme.lvh.me    | Acme tenant workspace    | SSO as alice              |
| https://globex.lvh.me  | Globex tenant workspace  | SSO as bob                |
| https://auth.lvh.me    | Keycloak admin console   | admin / admin             |
| https://traefik.lvh.me | Traefik dashboard        | admin / admin             |
| https://grafana.lvh.me | Grafana observability    | admin / admin             |
| https://mail.lvh.me    | Mailpit dev email inbox  | —                         |
| https://pgadmin.lvh.me | pgAdmin database browser | admin@example.com / admin |

### Direct debug ports (no TLS)

| Port             | Service             |
| ---------------- | ------------------- |
| `localhost:5434` | PostgreSQL          |
| `localhost:6379` | Redis               |
| `localhost:4317` | OTel Collector gRPC |
| `localhost:4318` | OTel Collector HTTP |

---

## Common Development Tasks

### Run Next.js locally (outside Docker)

```bash
pnpm install
pnpm --filter @platform/db generate   # generate Prisma client
pnpm dev                               # turbo dev for all packages
```

> The web app still expects Keycloak + Postgres + Redis from Docker. Run `pnpm dev:up` first.

### Database migrations

```bash
# Create a new migration
pnpm --filter @platform/db exec prisma migrate dev --name my_change

# Apply migrations (production)
pnpm --filter @platform/db exec prisma migrate deploy

# Re-seed the database
pnpm --filter @platform/db exec tsx src/seed.ts
```

### Rebuild the web container after code changes

```bash
cd infra/compose
docker compose build web
docker compose up -d web
```

### View logs

```bash
docker logs web -f
docker logs workers -f
docker logs keycloak -f
```

### Reset everything

```bash
pnpm dev:down     # stop and remove containers (keeps volumes)
pnpm dev:reset    # stop, remove containers AND delete all volumes (wipes database)
```

### Run tests

```bash
pnpm test         # unit tests via Vitest
pnpm typecheck    # TypeScript check across all packages
pnpm lint         # ESLint across all packages
```

---

## Database Schema Overview

```
Tenant ──┬── TenantUser ──── User ──── ExternalIdentity
         ├── RoleBinding ─── Role ─── RolePermission ─── Permission
         ├── Subscription ── Plan
         ├── UsageEvent
         ├── ScimToken
         ├── WebhookEndpoint ── WebhookDelivery
         ├── AuditLog
         ├── Note
         └── IdempotencyKey

Platform-level:
  Job (queue, payload, status, attempts, DLQ)
```

**Postgres roles:**

| Role             | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `app`            | LOGIN — runs app queries, subject to RLS                                |
| `migrator`       | LOGIN — runs Prisma migrations, member of `platform_admin`              |
| `platform_admin` | NOLOGIN, BYPASSRLS — used by `withPlatformAdmin()` for cross-tenant ops |

---

## Environment Variables Reference

| Variable                             | Required | Description                                                                      |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | ✅       | App Postgres connection string (role: `app`)                                     |
| `DATABASE_URL_MIGRATOR`              | —        | Migration Postgres URL (role: `migrator`); falls back to `DATABASE_URL`          |
| `KEYCLOAK_ISSUER`                    | ✅       | OIDC issuer URL (e.g. `https://auth.lvh.me/realms/saas-platform`)                |
| `KEYCLOAK_INTERNAL_ISSUER`           | —        | Docker-internal issuer for OIDC discovery (overrides `wellKnown` endpoint)       |
| `KEYCLOAK_CLIENT_ID`                 | ✅       | Keycloak OIDC client ID (e.g. `web`)                                             |
| `KEYCLOAK_CLIENT_SECRET`             | ✅       | Keycloak OIDC client secret                                                      |
| `AUTH_SECRET`                        | ✅       | Auth.js session encryption key (min 32 chars)                                    |
| `AUTH_URL`                           | ✅       | Public URL of this app (e.g. `https://app.lvh.me`)                               |
| `REDIS_URL`                          | ✅       | Redis connection string                                                          |
| `STRIPE_SECRET_KEY`                  | ✅       | Stripe secret key (`sk_test_...` or `sk_live_...`)                               |
| `STRIPE_WEBHOOK_SECRET`              | ✅       | Stripe webhook signing secret (`whsec_...`)                                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅       | Stripe publishable key (`pk_test_...`)                                           |
| `RESEND_API_KEY`                     | ✅       | Resend API key for transactional email                                           |
| `EMAIL_FROM`                         | ✅       | Sender address for transactional email                                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | —        | OTel Collector endpoint (default: `http://localhost:4318`)                       |
| `PLATFORM_INTERNAL_SECRET`           | ✅       | HMAC secret for internal service-to-service calls (min 16 chars)                 |
| `INVITE_TOKEN_SECRET`                | —        | HMAC secret for invite tokens (defaults to `dev-invite-secret` — change in prod) |
| `NEXT_PUBLIC_DEFAULT_TENANT_SLUG`    | —        | Fallback tenant slug when not on a subdomain (default: `acme`)                   |

---

## Production Deployment

A Helm chart is included at `infra/helm/saas-platform/` for Kubernetes.

```bash
# Dev cluster
helm upgrade --install saas-platform infra/helm/saas-platform \
  -f infra/helm/saas-platform/values-dev.yaml \
  --set image.tag=$(git rev-parse --short HEAD)

# Production
helm upgrade --install saas-platform infra/helm/saas-platform \
  -f infra/helm/saas-platform/values-prod.yaml \
  --set image.tag=$(git rev-parse --short HEAD)
```

The chart includes `Deployment`, `HorizontalPodAutoscaler`, `PodDisruptionBudget`, `IngressRoute` (Traefik CRD), and `NetworkPolicy`.

**Production checklist:**

- [ ] Replace `*.lvh.me` with your domain; update `KEYCLOAK_ISSUER`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- [ ] Use managed Postgres (RDS, Cloud SQL) with SSL
- [ ] Use managed Redis (ElastiCache, Upstash) with TLS
- [ ] Rotate all secrets (`AUTH_SECRET`, `PLATFORM_INTERNAL_SECRET`, `INVITE_TOKEN_SECRET`)
- [ ] Switch Stripe to live keys and a real webhook endpoint
- [ ] Configure a real SMTP sender in Resend
- [ ] Set up wildcard TLS via cert-manager (Let's Encrypt)
- [ ] Enable Keycloak production mode (`KC_HOSTNAME_STRICT=true`, replace `start-dev` with `start`)

---

## Package Dependency Graph

```
apps/web ──────── @platform/auth        @platform/authz
         │        @platform/billing     @platform/config
         │        @platform/db          @platform/jobs
         │        @platform/logger      @platform/notifications
         │        @platform/observability
         └─────── @platform/scim        @platform/tenant    @platform/ui

apps/workers ──── @platform/billing     @platform/config
              │   @platform/db          @platform/jobs
              └── @platform/logger      @platform/notifications
```

---

## Contributing

```bash
pnpm install
git checkout -b feat/my-feature
# make changes
git commit -m "feat: add my feature"   # Conventional Commits enforced by commitlint
git push origin feat/my-feature
```

Commit types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`

---

## License

MIT
