# Project: Riogentix SaaS Platform (saas-scaffolding)

## Overview

**Project Name:** riogentix  
**Platform:** Enterprise Multi-tenant SaaS  
**Location:** `/root/.openclaw/workspace/saas-scaffolding/`

---

## Tech Stack

| Layer         | Technology                                          |
| ------------- | --------------------------------------------------- |
| Framework     | Next.js 15 (App Router, RSC, Server Actions)        |
| Language      | TypeScript 5.5                                      |
| Auth          | Auth.js v5 (next-auth) + Keycloak 24 (OIDC/SAML)    |
| Database      | PostgreSQL 16 + Prisma 5 ORM + Row-Level Security   |
| Cache/Jobs    | Redis 7 + BullMQ                                    |
| Billing       | Stripe (Checkout, Customer Portal, webhooks)        |
| Email         | Resend (swappable via `@platform/notifications`)    |
| Reverse Proxy | Traefik v3 (TLS termination, subdomain routing)     |
| Observability | OpenTelemetry → Prometheus + Loki + Tempo + Grafana |
| Monorepo      | pnpm workspaces + Turborepo                         |
| Containers    | Docker Compose (dev) + Helm charts (Kubernetes)     |

---

## Project Structure

```
saas-scaffolding/
├── apps/
│   ├── web/                    # Next.js 15 application
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (admin)/    # Platform admin routes (/admin/*)
│   │       │   ├── (dashboard)/ # Tenant workspace routes (/t/{slug}/*)
│   │       │   ├── api/        # API route handlers
│   │       │   └── auth/       # Sign-in page
│   │       ├── components/
│   │       ├── lib/
│   │       └── middleware.ts   # Auth guard + tenant slug injection
│   └── workers/                # BullMQ worker process
│
├── packages/
│   ├── auth/                   # Auth.js config + Keycloak provider
│   ├── authz/                  # RBAC engine (can, hasEntitlement)
│   ├── billing/                # Stripe client + plan registry
│   ├── config/                 # Zod-validated env schema
│   ├── db/                     # Prisma schema, client helpers
│   ├── jobs/                   # BullMQ queue definitions
│   ├── logger/                 # pino logger + audit logging
│   ├── notifications/          # Email abstraction (Resend)
│   ├── observability/          # OTel SDK instrumentation
│   ├── scim/                   # SCIM 2.0 Users + Groups handlers
│   ├── tenant/                 # Subdomain resolver + tenant context
│   └── ui/                     # Shared React components
│
└── infra/
    ├── compose/                # Docker Compose files
    │   ├── docker-compose.yml              # Core services
    │   ├── docker-compose.observability.yml
    │   ├── docker-compose.tools.yml
    │   └── traefik/          # Traefik config
    ├── docker/                 # Dockerfiles
    │   ├── web.Dockerfile
    │   └── workers.Dockerfile
    ├── helm/saas-platform/     # Kubernetes Helm chart
    ├── keycloak/               # Keycloak realm export
    ├── postgres/init/          # DB role creation SQL
    └── observability/          # OTel, Prometheus, Loki, Tempo, Grafana config
```

---

## Environment Variables

### Required (from `.env`)

```bash
# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=https://saas.techhanker.com
PORT=3000

# Database
DATABASE_URL=postgresql://app:app_secret@postgres:5432/saas_platform
DATABASE_URL_MIGRATOR=postgresql://migrator:migrator_secret@postgres:5432/saas_platform

# Keycloak
KEYCLOAK_ISSUER=http://auth.techhanker.com/realms/saas-platform
KEYCLOAK_CLIENT_ID=web
KEYCLOAK_CLIENT_SECRET=saas-scaffolding-keycloak-secret

# Auth.js
AUTH_SECRET=saas-auth-secret-32-chars-min-abc123
AUTH_URL=https://saas.techhanker.com

# Redis
REDIS_URL=redis://localhost:6379

# Stripe (test)
STRIPE_SECRET_KEY=sk_test_stripe-test-secret-key-placeholder
STRIPE_WEBHOOK_SECRET=whsec_stripe-webhook-secret-placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_stripe-publishable-key-placeholder

# Email (Resend)
RESEND_API_KEY=re_1234567890_placeholder
EMAIL_FROM=noreply@example.com

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=saas-platform-web

# Internal
PLATFORM_INTERNAL_SECRET=internal-secret-16-chars

# Keycloak admin
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_INTERNAL_URL=http://keycloak:8080
KEYCLOAK_REALM=saas-platform

# HashiCorp Vault (optional)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=root
VAULT_MOUNT_PATH=secret

# Riogentix integration
RIOGENTIX_INTERNAL_URL=http://riogentix:7860
RIOGENTIX_INTERNAL_SECRET=riogentix-saas-internal-secret-dev
RIOGENTIX_SAAS_INTERNAL_SECRET=riogentix-saas-internal-secret-dev
RIOGENTIX_PUBLIC_URL=https://riogentix.techhanker.com
```

---

## Docker Compose Services

### Core Services (docker-compose.yml)

| Service      | Port                | Description                          |
| ------------ | ------------------- | ------------------------------------ |
| traefik      | 80, 443             | Reverse proxy with TLS termination   |
| oauth2-proxy | 4180 (internal)     | OIDC auth gate for tenant subdomains |
| keycloak-db  | 5432 (internal)     | PostgreSQL for Keycloak              |
| keycloak     | 8080 (internal)     | Identity provider (OIDC/SAML)        |
| app-db       | 5432 (exposed 5434) | PostgreSQL for app data              |
| redis        | 6379                | Cache and BullMQ queues              |
| web          | 3000 (internal)     | Next.js app                          |
| workers      | (internal)          | BullMQ workers                       |

### Observability Services (docker-compose.observability.yml)

- OTel Collector
- Prometheus
- Loki
- Tempo
- Grafana

### Tools Services (docker-compose.tools.yml)

- Mailpit (dev email)
- Stripe CLI
- pgAdmin

---

## Build & Deployment

### Local Development

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev:up

# Stop all services
pnpm dev:down

# Reset (remove volumes)
pnpm dev:reset
```

### Build Image

```bash
# Build web image
docker build -f infra/docker/web.Dockerfile -t saas-platform-web:latest .

# Build workers image
docker build -f infra/docker/workers.Dockerfile -t saas-platform-workers:latest .
```

### Kubernetes Deployment

```bash
# Install Helm dependencies
helm dep update infra/helm/saas-platform

# Deploy to dev
helm install saas-platform ./infra/helm/saas-platform -f ./infra/helm/saas-platform/values-dev.yaml

# Deploy to prod
helm install saas-platform ./infra/helm/saas-platform -f ./infra/helm/saas-platform/values-prod.yaml
```

---

## Multi-tenancy Architecture

### Subdomain Routing

- Tenant subdomain: `{slug}.techhanker.com`
- Root domain: `saas.techhanker.com` (marketing/auth site)
- Reserved subdomains: `auth`, `api`, `admin`, `app`, `t`, `www`, `traefik`, `grafana`, `mail`, `pgadmin`, `_health`

### Tenant Isolation

- **Postgres RLS**: All tenant tables have Row-Level Security enabled
- **RLS Bypass**: `platform_admin` role can access all tenants
- **Session Variable**: `app.tenant_id` is set via middleware header `x-tenant-slug`

### Auth Flow

1. User visits `{slug}.techhanker.com`
2. Traefik forwards to `oauth2-proxy` (forwardAuth)
3. `oauth2-proxy` redirects to Keycloak if unauthenticated
4. Keycloak issues JWT with `groups` claim
5. Session stored in encrypted cookie (`.techhanker.com` scope)
6. Request forwarded to Next.js app with `x-tenant-slug` header
7. Middleware extracts tenant slug and sets RLS session variable

---

## Keycloak Configuration

- **Realm**: `saas-platform`
- **Client**: `web` (Confidential)
- **Issuer URL**: `https://auth.techhanker.com/realms/saas-platform`
- **Groups**: `platform_super_admin`, `platform_support`, `tenant_admin`, `tenant_billing_admin`, `tenant_user`, `tenant_viewer`

---

## Stripe Integration

### Plans

| Plan       | Users     | SCIM | Webhooks | Feature Flags                                  |
| ---------- | --------- | ---- | -------- | ---------------------------------------------- |
| Free       | 5         | No   | No       | `users.max: 5`                                 |
| Pro        | 50        | Yes  | Yes      | `scim.enabled: true`, `webhooks.enabled: true` |
| Enterprise | Unlimited | Yes  | Yes      | Custom domains                                 |

### Webhook Events

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## Observability

### Traces

- OTel SDK → OTel Collector → Tempo

### Metrics

- Prometheus scrape endpoints on `/metrics`
- Grafana datasource: Prometheus

### Logs

- Structured JSON logs with `request_id`, `tenant_id`, `user_id`
- OTel Collector → Loki → Grafana

---

## Key URLs (Development)

| Service           | URL                         |
| ----------------- | --------------------------- |
| App               | https://saas.techhanker.com |
| Auth              | https://auth.techhanker.com |
| Traefik Dashboard | https://traefik.lvh.me      |
| Grafana           | https://grafana.lvh.me      |
| Keycloak Admin    | http://keycloak:8080/admin  |

---

## Important Notes

1. **Gateway**: DO NOT restart the OpenClaw gateway — it kills the bot mid-session and triggers a crash loop

2. **RunPod GPU Pod**: Available at `~/openclaw-tools/runpod_control.py`
   - Start: `python3 ~/openclaw-tools/runpod_control.py start`
   - Stop: `python3 ~/openclaw-tools/runpod_control.py stop`
   - Status: `python3 ~/openclaw-tools/runpod_control.py status`

3. **Domain**: All services use `techhanker.com` as the base domain

4. **SSL Certs**: mkcert-generated certs for `*.lvh.me` and `*.techhanker.com`

5. **Docker API Version**: Traefik uses Docker API 1.44, host may have 1.52 — need socket proxy workaround
