# Enterprise SaaS Scaffolding — Enhanced Plan & Phased Build

**Status:** v2 (supersedes `saas_scaffolding_requirements_nextjs_keycloak_scim_stripe.md`)
**Stack:** Next.js 15 · Keycloak · Postgres · Redis · Stripe · SCIM 2.0 · Traefik · OpenTelemetry · Docker Compose (local) · Kubernetes / Helm (prod)
**Build philosophy:** every phase ends with a *running, testable* slice. Nothing is built that cannot be smoke-tested the same day.

---

## Part 1 — Evaluation of the v1 Requirements Document

### What v1 gets right
- Tenant-first thinking and zero-trust framing are the correct north star.
- Layered architecture (Edge → App → Platform Services → Data → Async → Observability) is a clean mental model.
- Calls out the right hard problems early: SCIM idempotency, webhook resilience, RBAC + ABAC + entitlements as three composable layers, audit-log obligation, white-label.
- Leaves room for future evolution (multi-region, dedicated tenant infra, plugin ecosystem).

### Where v1 is weak (and what v2 fixes)
| Gap in v1 | Why it matters | Fix in v2 |
|---|---|---|
| Tech-agnostic to a fault | A "blueprint" you can't build from is a wishlist. | Concrete, opinionated stack locked in §2 with rationale. |
| Tenant routing strategy unspecified | Subdomain vs. path radically changes cookies, TLS, and Keycloak realm design. | Subdomain-per-tenant standardized; custom-domain path documented. |
| Isolation model unspecified | "Strict tenant isolation" is a goal, not a mechanism. | Shared DB + `tenant_id` + Postgres **Row-Level Security** as defense-in-depth. |
| Data model sketches only 5 tables | Misses roles, permissions, role bindings, entitlements, API keys, webhooks, jobs, idempotency keys. | Expanded data model in §3.4. |
| Authorization flow handwaved | "Roles → Permissions → Entitlements → Policies → Decision" with no concrete library or claim shape. | Concrete claims, JIT mapping from Keycloak, and an `authz` package signature. |
| SCIM listed but not designed | SCIM 2.0 has gnarly idempotency and ETag rules. | §4.13 enumerates endpoints, idempotency strategy, and conformance tests. |
| No build order | Teams attempt big-bang integration and stall. | 18 ordered phases, each with run/test/exit criteria. |
| No local dev story | Custom domains + TLS locally is its own subproject. | `*.lvh.me` + mkcert wildcard, documented Phase 3. |
| Observability listed, not specified | "Logs, metrics, traces" can mean anything. | Concrete OTel + Grafana LGTM stack in Phase 10. |
| Production deployment absent | Says "horizontal scaling" but no manifests or topology. | Helm chart layout, ingress, secrets, and HPA in §6 / Phase 16. |
| Async layer underspecified | Queue choice, DLQ, idempotency keys, scheduling all missing. | BullMQ on Redis, dedicated worker process, idempotency table. |
| Compliance vague | "Retention, export, delete" but no flows. | Tenant-scoped export + cryptographic delete documented. |

### What v2 keeps
The principles, the layered model, the epic list, and the RBAC/ABAC/entitlements three-layer authorization model. Those are good. Everything else is sharpened.

---

## Part 2 — Concrete Tech Stack (locked-in decisions)

| Concern | Choice | Why |
|---|---|---|
| Frontend + API | **Next.js 15** (App Router, RSC, route handlers) | One framework for UI + tenant-aware API; great DX; first-class TypeScript. |
| Language | **TypeScript** everywhere | One mental model server + client. |
| Identity Provider | **Keycloak 24+** | Open-source, OIDC + SAML + SCIM consumer-side, supports realm-per-tenant when needed. |
| Auth library (app side) | **Auth.js v5** (NextAuth) with Keycloak provider | Mature, App Router-native, JWT or DB sessions. |
| Database | **Postgres 16** | RLS, partitioning, JSONB, mature ecosystem. |
| ORM / migrations | **Prisma 5** | Best DX, mature migrations, RLS-compatible via raw SQL escape hatch. |
| Tenant isolation | **Shared DB + `tenant_id` + Postgres RLS** | Single point of policy enforcement; defense-in-depth even if app code has bugs. |
| Cache / queue backend | **Redis 7** | Single tool for sessions, rate limit, BullMQ. |
| Async jobs | **BullMQ** (Node) | First-class Redis queue, delayed jobs, retries, DLQ, repeat. |
| Reverse proxy / ingress | **Traefik v3** | Auto-discovers Docker labels locally; first-class K8s IngressRoute CRD; same tool local + prod. |
| TLS (local) | **mkcert** | Trusted local certs, no browser warnings. |
| TLS (prod) | **cert-manager + Let's Encrypt** | Standard K8s pattern. |
| Local hostnames | `*.lvh.me` (or `*.localtest.me`) | Wildcard DNS to 127.0.0.1, no `/etc/hosts` edits. |
| Logging | **pino** (structured JSON) | Fast, JSON, well-supported. |
| Tracing / metrics SDK | **OpenTelemetry** | Vendor-neutral; one SDK, many backends. |
| Observability backend (local + prod) | **Grafana LGTM** (Loki + Grafana + Tempo + Mimir/Prom) | Single UI, single org to operate, all OSS. |
| Billing | **Stripe** (Checkout + Customer Portal + Webhooks) | Enterprise-ready, well-documented webhook signing. |
| SCIM | **SCIM 2.0** endpoints in Next.js route handlers | Owns provisioning, decoupled from Keycloak. |
| Email | **Resend** or **SES** | Pluggable through a `@platform/notifications` package. |
| Secrets (local) | `.env` files, `direnv` optional | Simple. |
| Secrets (prod) | **External Secrets Operator** + **Vault** (or cloud KMS) | Pull at runtime, never bake into images. |
| Container build | Multi-stage Dockerfile, **distroless** runtime | Small, secure. |
| Local orchestration | **Docker Compose** (multiple files merged) | Matches user's "Docker Desktop" requirement. |
| Prod orchestration | **Kubernetes** + **Helm 3** | Industry standard. |
| Monorepo | **pnpm workspaces + Turborepo** | Fast, cache-aware, scales to many packages. |
| Lint / format | **ESLint + Prettier + tsc strict** | Boring, effective. |
| Tests | **Vitest** (unit) + **Playwright** (e2e) + **k6** (load) | Right tool for each layer. |
| CI | **GitHub Actions** | Default; swap easily. |

Override any of these later, but lock them now so the phased plan stays concrete.

---

## Part 3 — Concrete Architecture

### 3.1 Service topology (local Compose, mirrors prod)

```text
                          ┌──────────────────────┐
   Browser ── lvh.me ────►│  Traefik (edge)      │  *.lvh.me wildcard, TLS via mkcert
                          └──────────┬───────────┘
                                     │
            ┌────────────────────────┼─────────────────────────────┐
            ▼                        ▼                             ▼
    ┌──────────────┐         ┌──────────────┐              ┌────────────────┐
    │ Next.js web  │◄────────┤  Keycloak    │              │ Grafana (LGTM) │
    │ (app+api)    │  OIDC   │  + Postgres  │              │  + OTel coll.  │
    └──────┬───────┘         └──────────────┘              └────────────────┘
           │
   ┌───────┼────────┬─────────────────┬───────────────────┐
   ▼       ▼        ▼                 ▼                   ▼
┌──────┐ ┌──────┐ ┌────────────┐  ┌────────────┐    ┌──────────────┐
│ App  │ │Redis │ │ Workers    │  │ Stripe CLI │    │ Mailpit      │
│ PG   │ │      │ │ (BullMQ)   │  │ (webhooks) │    │ (dev SMTP)   │
└──────┘ └──────┘ └────────────┘  └────────────┘    └──────────────┘
```

Key invariant: **Traefik is the only ingress**. Direct ports on services are exposed only to `localhost` for debugging.

### 3.2 Multi-tenancy model

- **Tenant resolution:** Traefik routes `*.lvh.me` to Next.js. A Next.js `middleware.ts` extracts the leftmost label, looks up `tenant.slug → tenant_id` (Redis-cached), and stamps the `tenant_id` into a request-scoped context (`AsyncLocalStorage`).
- **Reserved subdomains:** `auth.`, `api.`, `admin.`, `app.`, `www.`, `_health.` (no tenant lookup).
- **Custom domains (white-label):** Same `tenants` table has a `custom_domains[]` column; Traefik's dynamic config reads it to issue per-domain certs.
- **DB enforcement:** Every tenant-scoped table has a `tenant_id uuid not null` column and a Postgres **RLS policy** of the form:
  ```sql
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  ```
  The Prisma client wraps every transaction with `SET LOCAL app.tenant_id = $1` so RLS bites even on programmer error. The platform-admin role uses a separate Prisma client that bypasses RLS via `SET LOCAL ROLE platform_admin`.
- **Realm strategy:** **Single Keycloak realm** (`saas-platform`). Tenant membership is a group + custom token claim `tenant_ids[]`. Future enterprise SKU can opt into realm-per-tenant.

### 3.3 Authentication & authorization flow

```
Browser → Traefik → Next.js
                    │
                    ├─ middleware.ts: resolve tenant from host
                    ├─ Auth.js handler:
                    │     ├─ unauthenticated → redirect to Keycloak
                    │     └─ authenticated   → JWT with claims:
                    │           sub, email, tenant_ids[],
                    │           roles_by_tenant{ tenant_id: [role,...] },
                    │           plan_by_tenant{ tenant_id: "free"|"pro"|"ent" }
                    ├─ authz layer: 
                    │     1. Tenant gate:    user has access to current tenant?
                    │     2. RBAC check:     does role grant resource:action?
                    │     3. ABAC policies:  same-tenant, ownership, etc.
                    │     4. Entitlements:   plan permits this feature?
                    └─ DB call (with `SET LOCAL app.tenant_id`)
```

The `roles_by_tenant` and `plan_by_tenant` claims come from a **Keycloak ProtocolMapper** that calls the platform's `/internal/userinfo-augment` endpoint on token issuance (or are computed locally on first session and cached in Redis with short TTL). Pick one and document it; the plan uses the cached-augment approach.

### 3.4 Expanded data model

```sql
-- Identity & tenancy
tenant(id uuid pk, slug citext unique, name, status, plan,
       custom_domains text[], branding jsonb, created_at, updated_at)

users(id uuid pk, external_id text unique,        -- Keycloak sub
      email citext unique, status,
      created_at, updated_at)

tenant_users(tenant_id, user_id, status, joined_at,
             PRIMARY KEY (tenant_id, user_id))

-- Authorization
roles(id, tenant_id NULLABLE, name, is_system bool)
       -- tenant_id NULL = platform/system role
permissions(id, code text unique)        -- e.g. 'user:create'
role_permissions(role_id, permission_id)
role_bindings(tenant_id, user_id, role_id)

-- Entitlements & billing
plans(id, code, name, features jsonb, price_id_stripe)
subscriptions(tenant_id pk, plan_id, status, stripe_customer_id,
              stripe_subscription_id, current_period_end,
              trial_ends_at)
usage_events(id, tenant_id, kind, quantity, occurred_at)
              -- partitioned monthly

-- SCIM
scim_tokens(id, tenant_id, name, hashed_token, scopes[],
            created_at, last_used_at)
external_identities(id, tenant_id, user_id, idp text, idp_user_id,
                    raw jsonb, UNIQUE(tenant_id, idp, idp_user_id))

-- Audit
audit_log(id bigserial, tenant_id, actor_user_id, action,
          resource_type, resource_id, before jsonb, after jsonb,
          ip inet, user_agent, occurred_at)
        -- partitioned monthly, write-only, retained per plan

-- Async / idempotency
jobs(id, tenant_id, queue, payload jsonb, status, attempts,
     scheduled_for, last_error, created_at)
idempotency_keys(key text pk, tenant_id, request_hash, response jsonb,
                 expires_at)

-- Webhooks (inbound + outbound)
webhook_endpoints(id, tenant_id, url, secret, events[], status)
webhook_deliveries(id, endpoint_id, event_id, status, attempts,
                   last_error, next_retry_at)
```

All tenant-scoped tables get the standard RLS policy. `audit_log` is append-only; `before/after` are scrubbed of secrets by a logging helper before insert.

---

## Part 4 — Repository Layout (monorepo)

```
saas-platform/
├── apps/
│   ├── web/                        # Next.js 15 app (UI + route handlers)
│   └── workers/                    # BullMQ worker process
├── packages/
│   ├── db/                         # Prisma schema, client, RLS helpers, seeds
│   ├── auth/                       # Auth.js config, Keycloak provider, JWT helpers
│   ├── authz/                      # RBAC + ABAC + entitlements engine
│   ├── tenant/                     # subdomain → tenant resolution, AsyncLocalStorage
│   ├── billing/                    # Stripe client, webhooks, plan registry
│   ├── scim/                       # SCIM 2.0 handlers (User, Group, /Schemas)
│   ├── notifications/              # email/SMS abstraction
│   ├── logger/                     # pino + OTel resource attributes
│   ├── observability/              # OTel SDK setup, instrumentation
│   ├── config/                     # zod-validated env config
│   └── ui/                         # shared React components / theming
├── infra/
│   ├── docker/                     # Dockerfiles per service
│   │   ├── web.Dockerfile
│   │   └── workers.Dockerfile
│   ├── compose/
│   │   ├── docker-compose.yml              # core: traefik, web, db, redis, keycloak
│   │   ├── docker-compose.observability.yml # grafana, loki, tempo, prometheus, otel-col
│   │   ├── docker-compose.tools.yml        # mailpit, stripe-cli, pgadmin
│   │   └── traefik/
│   │       ├── traefik.yml
│   │       └── dynamic/                    # tenant-domain dynamic config
│   ├── keycloak/
│   │   ├── realm-export.json
│   │   └── themes/
│   ├── helm/
│   │   └── saas-platform/                  # umbrella chart (web, workers, …)
│   └── k8s/
│       └── overlays/                       # kustomize per env
├── scripts/
│   ├── dev.sh                       # one-shot bring-up
│   ├── mkcert-setup.sh
│   ├── seed.ts
│   └── reset.sh
├── tests/
│   ├── e2e/                         # Playwright
│   └── load/                        # k6
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

---

## Part 5 — Local Development Conventions

- **Hostnames:** `*.lvh.me` resolves to `127.0.0.1` automatically — use `app.lvh.me`, `auth.lvh.me`, `acme.lvh.me`, `globex.lvh.me`. No hosts-file edits, ever.
- **TLS locally:** `scripts/mkcert-setup.sh` runs `mkcert -install` and `mkcert "*.lvh.me" lvh.me`. Traefik mounts the cert.
- **Env files:** `.env` (committed defaults via `.env.example`), `.env.local` (gitignored, secrets). `@platform/config` validates with zod and refuses to boot on missing/invalid env.
- **One command up:** `pnpm dev:up` → `docker compose -f infra/compose/docker-compose.yml -f docker-compose.observability.yml up -d` then `turbo run dev`.
- **One command down:** `pnpm dev:down` (preserves volumes), `pnpm dev:reset` (nukes volumes).
- **Tenant fixtures:** seed creates two tenants — `acme` and `globex` — and a platform admin user. Login URLs: `https://acme.lvh.me`, `https://globex.lvh.me`.

---

## Part 6 — Phased Build Plan

Each phase: **Goal → Deliverables → Run → Test → Exit criteria**. Do not start phase N+1 until phase N's exit criteria are green.

---

### Phase 0 — Repo, Tooling & Empty Compose

**Goal.** A monorepo that lints, builds, and brings up an empty Compose stack.

**Deliverables.**
- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with `dev`, `build`, `lint`, `test`, `typecheck` scripts.
- ESLint + Prettier + Husky + lint-staged + commitlint.
- `infra/compose/docker-compose.yml` with a single `whoami` test service behind Traefik (Phase 3 will replace whoami with the real app).
- `.env.example`, `scripts/mkcert-setup.sh`.
- README with architecture diagram and quickstart.

**Run.**
```bash
pnpm install
pnpm lint && pnpm typecheck
docker compose -f infra/compose/docker-compose.yml up -d
```

**Test.**
```bash
curl -fsS http://localhost/whoami    # 200, returns hostname
```

**Exit criteria.** CI green on a no-op PR; `dev:up` and `dev:down` both work cleanly; pre-commit hook rejects bad code.

---

### Phase 1 — Keycloak + its Postgres

**Goal.** A running Keycloak you can log into and configure, isolated from the app DB.

**Deliverables.**
- Compose services: `keycloak-db` (Postgres 16) and `keycloak` (quay.io/keycloak/keycloak:24).
- Persistent volume for Keycloak's DB.
- `infra/keycloak/realm-export.json` with realm `saas-platform`, one client `web`, two demo users (`alice@acme.test`, `bob@globex.test`), groups `acme`, `globex`, and a custom claim mapper for `tenant_ids`.
- `KC_HOSTNAME`, `KC_PROXY` set so Keycloak is happy behind Traefik later.

**Run.**
```bash
docker compose up -d keycloak-db keycloak
```

**Test.**
- `http://localhost:8080` → admin console (admin/admin).
- Realm `saas-platform` exists with users alice and bob.
- `curl http://localhost:8080/realms/saas-platform/.well-known/openid-configuration` returns valid JSON.

**Exit criteria.** Realm survives `docker compose restart keycloak`; admin login works; OIDC discovery endpoint serves expected URLs.

---

### Phase 2 — Next.js Hello World, Dockerized

**Goal.** A bare Next.js app running in a container, no auth, no DB.

**Deliverables.**
- `apps/web/` from `create-next-app` (TS, App Router, Tailwind).
- A `/` page and `/_health` route handler (returns `{ ok: true, sha, env }`).
- `infra/docker/web.Dockerfile` (multi-stage: deps → build → distroless runner).
- Compose service `web` exposing 3000 internally (no host port; Traefik in Phase 3 will front it).

**Run.**
```bash
docker compose up -d --build web
```

**Test.**
```bash
docker compose exec web wget -qO- http://localhost:3000/_health
# {"ok":true,...}
```

**Exit criteria.** Hot reload works in dev mode (`pnpm --filter web dev`), prod image is < 200 MB, `_health` returns 200.

---

### Phase 3 — Traefik Reverse Proxy + Local TLS

**Goal.** Real domain names with HTTPS for the app and Keycloak.

**Deliverables.**
- `scripts/mkcert-setup.sh` produces `infra/compose/traefik/certs/_wildcard.lvh.me-key.pem` and `.pem`.
- `traefik.yml` (entrypoints :80, :443; redirect to https), dynamic config mounting the cert.
- Labels on `web` and `keycloak` services routing:
  - `app.lvh.me` → web
  - `*.lvh.me` (priority lower than reserved hosts) → web (tenant routing)
  - `auth.lvh.me` → keycloak
  - `traefik.lvh.me` → Traefik dashboard (basic-auth)

**Run.**
```bash
./scripts/mkcert-setup.sh
docker compose up -d traefik
```

**Test.**
```bash
curl -fsS https://app.lvh.me/_health
curl -fsS https://auth.lvh.me/realms/saas-platform/.well-known/openid-configuration
```

**Exit criteria.** Both URLs serve over HTTPS in a real browser with no warnings; HTTP redirects to HTTPS; Traefik dashboard reachable.

---

### Phase 4 — App Postgres + Prisma + Initial Schema

**Goal.** Persistent storage with migrations, separate from Keycloak's DB.

**Deliverables.**
- Compose service `app-db` (Postgres 16) with named volume.
- `packages/db/` with Prisma schema for `tenants`, `users`, `tenant_users`.
- Migration `0001_init`. Seed script creates two tenants (`acme`, `globex`).
- A simple `/api/tenants` route in the web app that lists tenants (no auth yet — temporary).

**Run.**
```bash
docker compose up -d app-db
pnpm --filter @platform/db migrate:dev
pnpm --filter @platform/db seed
```

**Test.**
```bash
curl -fsS https://app.lvh.me/api/tenants | jq
# [{"slug":"acme",...}, {"slug":"globex",...}]
```

**Exit criteria.** Migrations are reproducible from scratch; seed is idempotent; `prisma studio` opens.

---

### Phase 5 — Auth.js + Keycloak OIDC

**Goal.** Real login/logout against Keycloak; sessions visible in the app.

**Deliverables.**
- `packages/auth/` with Auth.js v5 config, Keycloak provider, JWT session strategy.
- `apps/web/app/api/auth/[...nextauth]/route.ts`.
- Login/logout buttons, `/me` page showing the JWT claims.
- On first login, a `users` row is created (email + Keycloak `sub` as `external_id`).

**Run.** Already running. Visit `https://app.lvh.me`, click Sign in.

**Test.**
- Click "Sign in" → redirected to `auth.lvh.me`, log in as alice, redirected back.
- `/me` shows email, sub, and (empty for now) `tenant_ids`.
- Sign out clears session.

**Exit criteria.** Session survives page reload; logout actually invalidates the Keycloak session; new user creates a `users` row idempotently.

---

### Phase 6 — Tenant Resolution + Postgres RLS

**Goal.** `acme.lvh.me` shows acme's data only; `globex.lvh.me` shows globex's only — enforced in the database.

**Deliverables.**
- `packages/tenant/` exposes `getTenantContext()` (AsyncLocalStorage); Next.js `middleware.ts` resolves subdomain → `tenant_id` via Redis (introduced in Phase 8 — for now, Postgres lookup, no cache).
- `packages/db/` adds `tenant_id` columns and **RLS policies** to all tenant-scoped tables (so far: `tenant_users`).
- A new tenant-scoped table `notes(id, tenant_id, body, created_at)` with seed rows for both tenants.
- `/api/notes` returns notes; without a valid tenant, returns 404.
- DB client wrapper sets `SET LOCAL app.tenant_id = $1` on every transaction.

**Run.** Compose already up.

**Test.**
```bash
curl -fsS https://acme.lvh.me/api/notes   # only acme's notes
curl -fsS https://globex.lvh.me/api/notes # only globex's notes
# Belt-and-suspenders: even if we deliberately bypass app filter,
# RLS prevents cross-tenant reads. Verify in psql:
psql ... -c "SET app.tenant_id = '<acme uuid>'; SELECT count(*) FROM notes;"  # only acme rows
```

**Exit criteria.** A red-team test (a route that "forgets" to filter by `tenant_id`) **still** returns only the right tenant's data, because RLS catches it.

---

### Phase 7 — RBAC + ABAC + Entitlements

**Goal.** Role-gated and plan-gated features, enforced in one place.

**Deliverables.**
- `packages/authz/` with:
  - `can(user, "resource:action", resource?)` API.
  - System roles seeded: `platform_super_admin`, `platform_support`, `tenant_admin`, `tenant_billing_admin`, `tenant_user`, `tenant_viewer`.
  - Permission catalog (typed enum).
  - ABAC policies: `same_tenant`, `is_self`, `is_owner`.
  - Entitlement check against `plans.features` JSON.
- Token augmentation on session callback: load `roles_by_tenant` and `plan_by_tenant` into the JWT (cached in Redis once Phase 8 lands).
- Two demo gated endpoints:
  - `POST /api/notes` — requires `notes:create` (tenant_user+).
  - `DELETE /api/notes/:id` — requires `notes:delete` (tenant_admin+) AND `is_owner` ABAC, only on Pro+.

**Test.**
- alice (tenant_admin of acme): can create/delete in acme.
- alice in globex context: 403.
- bob (tenant_user of globex): can create, cannot delete others'.
- Free-plan tenant: delete returns 402 Payment Required with `feature: notes.delete`.

**Exit criteria.** A single `withAuthz()` helper wraps every protected route handler; misuse is caught by a unit test.

---

### Phase 8 — Redis: Sessions, Cache, Rate Limiting

**Goal.** Stateless web pods. Tenant lookups, rate limits, and session cache all in Redis.

**Deliverables.**
- Compose service `redis` with persistence.
- `packages/auth/` switched to Redis-backed session adapter (or refresh-token cache).
- Tenant resolver caches `slug → tenant` for 60s in Redis.
- Rate-limit middleware (sliding window, per-IP and per-tenant) using `@upstash/ratelimit` or hand-rolled Lua.

**Test.**
```bash
# Rate limit
hey -n 200 -c 20 https://acme.lvh.me/api/notes
# Should see ~20% 429s with the right headers (X-RateLimit-*).
docker compose restart web   # session survives
```

**Exit criteria.** Killing the web container does not invalidate logged-in sessions; rate limiter returns 429 with informative headers; tenant cache hit ratio visible in logs.

---

### Phase 9 — Structured Logging + Audit Log

**Goal.** Every request has a JSON log line tagged with `tenant_id`, `user_id`, `request_id`. Sensitive actions land in `audit_log`.

**Deliverables.**
- `packages/logger/` (pino) wired into Next.js + workers, with a request-id middleware.
- `packages/observability/` initial setup (just resource attributes for now).
- Audit middleware: any mutation that goes through `withAuthz()` writes to `audit_log` with diff (`before`, `after`), scrubbed.
- `/admin/audit` page (platform_super_admin only) lists last 100 entries.

**Test.**
```bash
docker compose logs web | jq 'select(.tenant_id == "<acme>")'
psql -c "SELECT action, count(*) FROM audit_log GROUP BY action;"
```

**Exit criteria.** No log line ever contains a secret (verified by a regex test); audit_log row exists for every state-changing API call.

---

### Phase 10 — Observability Stack: OTel → Grafana LGTM

**Goal.** Click a trace from Grafana → see logs for that request → pivot to metrics.

**Deliverables.**
- `docker-compose.observability.yml`: `grafana`, `loki`, `tempo`, `prometheus`, `otel-collector`.
- `packages/observability/` initializes the OTel SDK (auto-instrumentation for HTTP, Prisma, Redis).
- pino → OTel logs exporter (or stdout → Loki via promtail; pick one — plan picks OTel direct).
- Pre-baked Grafana dashboards: HTTP overview, DB pool, Redis, BullMQ.
- Exemplars wired so traces appear on metric panels.

**Test.** Hit `/api/notes`, find the trace in Tempo via `tenant_id` attribute, jump to logs, see Prom counter increment.

**Exit criteria.** Three-pillar correlation works end-to-end; dashboards show non-zero data; OTel collector restart does not lose data (uses persistent volume for WAL).

---

### Phase 11 — Async Workers (BullMQ)

**Goal.** A separate worker process pulling jobs off Redis, with retries and DLQ.

**Deliverables.**
- `apps/workers/` — a Node entrypoint that registers BullMQ workers for queues: `email`, `webhook-inbound`, `webhook-outbound`, `usage-rollup`.
- `infra/docker/workers.Dockerfile`.
- Compose service `workers` with `replicas: 2`.
- `packages/jobs/` exposes typed `enqueue(queue, payload, opts)` helpers, with backoff and `removeOnComplete`/`removeOnFail` rules.
- DLQ inspection page at `/admin/jobs`.
- Idempotency table `idempotency_keys` and a `withIdempotency()` helper.

**Test.**
```bash
# Enqueue a flaky job; verify retries; force final failure → lands in DLQ.
curl -X POST https://app.lvh.me/api/admin/test-job
docker compose logs -f workers
```

**Exit criteria.** Job retried with exponential backoff, DLQ visible; restarting workers mid-job results in resumption (no double-execution thanks to idempotency keys).

---

### Phase 12 — Stripe Billing

**Goal.** Tenant admin can subscribe; entitlements update from webhooks; gated features unlock.

**Deliverables.**
- `packages/billing/` with Stripe client, plan registry, webhook signature verification, idempotent event handlers.
- Compose service `stripe-cli` running `stripe listen --forward-to web:3000/api/billing/webhook` so local Stripe events reach the app.
- `/billing` UI: current plan, "Manage subscription" → Stripe Customer Portal; "Upgrade" → Stripe Checkout.
- Webhook handlers update `subscriptions` row, then enqueue a `plan-changed` job that recomputes cached entitlements.
- Per-plan entitlements wired into the Phase 7 `authz` engine.

**Test.**
- `stripe trigger customer.subscription.created` → tenant moves to Pro.
- Pro-only endpoint becomes available within 5 seconds.
- Replaying the same event id is a no-op (idempotency).

**Exit criteria.** All Stripe events the app cares about are handled idempotently; failed webhooks retry via BullMQ with DLQ; downgrade revokes entitlements.

---

### Phase 13 — SCIM 2.0 Endpoints

**Goal.** External IdPs (Okta, Entra ID) can provision users and groups into a tenant.

**Deliverables.**
- `packages/scim/` implementing `/scim/v2/Users`, `/Groups`, `/Schemas`, `/ServiceProviderConfig`, `/ResourceTypes`. RFC 7643/7644-compliant.
- Per-tenant SCIM bearer tokens (table `scim_tokens`) with scoped permissions; token issuance UI in tenant admin.
- Idempotency on `externalId`; ETag handling for `If-Match`.
- All SCIM mutations write to `audit_log`.
- Conformance test suite (Vitest) covering create/get/patch/delete for users + groups, including `Operations` patch ops.

**Test.**
```bash
TOKEN=...
curl -H "Authorization: Bearer $TOKEN" https://acme.lvh.me/scim/v2/Users
# Provision a user via POST; verify users + tenant_users + audit_log rows.
```

**Exit criteria.** Conformance suite green; token rotation works; replaying a SCIM POST with the same `externalId` returns 200, not 409.

---

### Phase 14 — White-Label: Custom Domains + Theming

**Goal.** `app.acme.com` serves Acme's branded login page and UI.

**Deliverables.**
- `tenants.custom_domains[]` column + admin UI to add a domain (DNS instructions, ACME validation status).
- Traefik dynamic config generator: a small worker watches `tenants` and writes `infra/compose/traefik/dynamic/tenant-domains.yml`, mapping each custom domain to the web service. (Prod: cert-manager `Certificate` per domain.)
- `tenants.branding jsonb` (logo URL, primary/secondary colors, email-from) consumed by `packages/ui/` theme provider.
- Per-tenant email templates with branded headers via `packages/notifications/`.

**Test.** Add `acme.test.local` (or a real domain in prod-like staging). After cert issuance, the URL serves Acme's logo and colors.

**Exit criteria.** Domain add → cert issued → tenant resolves correctly within 60s; removing domain revokes cert.

---

### Phase 15 — Security Hardening

**Goal.** OWASP-clean baseline.

**Deliverables.**
- Strict CSP (nonce-based), HSTS preload, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix where possible, host-scoped per tenant.
- CSRF: rely on SameSite + Origin/Referer checks for cookie-auth; bearer-auth for API.
- Secret scanning (gitleaks) + dependency audit (`pnpm audit`, `npm audit signatures`) in CI.
- npm provenance enforcement; lockfile pinning.
- DB: least-privilege role for the app (no DDL); separate `migrator` role used only by deployment job.
- Rate-limit policies tightened by route; brute-force protection on auth callback.
- Tenant suspension flow (immediately blocks all tenant traffic at middleware).

**Test.** ZAP baseline scan, `nikto`, manual review of cookie flags; pen-test the cross-tenant access path again.

**Exit criteria.** No high/critical findings on baseline scans; CI fails on new high-severity dependency CVEs.

---

### Phase 16 — Kubernetes Packaging (Helm)

**Goal.** `helm install` brings the platform up on a kind/minikube cluster, then any real cluster.

**Deliverables.**
- `infra/helm/saas-platform/` umbrella chart with sub-charts (or templates) for: `web`, `workers`, `traefik` (via official chart), `keycloak` (Bitnami), `postgresql` (Bitnami), `redis` (Bitnami), `loki`, `tempo`, `prometheus`, `grafana`, `cert-manager` (dependency), `external-secrets` (dependency).
- Manifests:
  - `Deployment` + `HPA` + `PodDisruptionBudget` for `web` and `workers`.
  - `Service`, `IngressRoute` (Traefik CRD), `Certificate` (cert-manager).
  - `NetworkPolicy`: only Traefik can talk to web; only web/workers can talk to Postgres and Redis.
  - `PodSecurityContext`: non-root, read-only FS, drop all caps.
  - Probes: `/_health` (live), `/_ready` (ready, checks DB + Redis).
- Secrets via `ExternalSecret` referring to a Vault path.
- `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`.
- A `chart-testing` CI job; a kind-based smoke test that runs the same Phase 6 cross-tenant assertion.

**Test.**
```bash
kind create cluster
helm dependency update infra/helm/saas-platform
helm install platform infra/helm/saas-platform -f values-dev.yaml
kubectl wait --for=condition=available deploy/web --timeout=300s
./scripts/k8s-smoke.sh
```

**Exit criteria.** `helm install` from clean is reproducible; `helm upgrade` is non-destructive; rolling deploy keeps p99 latency stable; `kubectl drain` of any node does not break the app.

---

### Phase 17 — CI/CD

**Goal.** Every PR builds, tests, scans; every tag deploys.

**Deliverables.**
- `.github/workflows/ci.yml`: install → typecheck → lint → unit tests → build images → e2e (Playwright against ephemeral Compose) → SCIM conformance → chart-test → security scans (gitleaks, trivy, ZAP baseline).
- `.github/workflows/release.yml`: on tag, push images to registry with SBOM + provenance, render Helm chart, push to OCI registry, deploy to staging, run smoke tests, gate on manual approval for prod.
- Branch protection requiring all checks green; CODEOWNERS for `packages/authz/`, `packages/db/`, `infra/`.

**Exit criteria.** PR-to-deploy is fully automated for staging; prod is one-click after staging smoke passes.

---

## Part 7 — Production Notes (Kubernetes specifics)

- **Ingress:** Traefik IngressController in HA (3 replicas across zones), Service type `LoadBalancer`. Wildcard cert for the platform domain via cert-manager DNS01; per-tenant custom-domain certs via HTTP01.
- **Stateful services:** Use managed offerings for Postgres (RDS/Cloud SQL) and Redis (ElastiCache/Memorystore) in real prod. Helm chart supports both modes via `values.postgres.external: true|false`.
- **Multi-AZ:** All Deployments have `topologySpreadConstraints` across zones; PDBs set `maxUnavailable: 1`.
- **Autoscaling:** HPA on CPU + custom metric (RPS via Prom adapter). KEDA for workers based on BullMQ queue depth.
- **Backups:** PITR for Postgres (15-min RPO); nightly logical dump to object storage with 30-day retention; quarterly restore drill.
- **DR:** Multi-region active-passive. Read replicas in DR region; promote runbook; Route53 health-check failover.
- **Secrets:** External Secrets Operator → Vault (or AWS Secrets Manager). No `Secret` objects checked into git; sealed-secrets is acceptable as a fallback.
- **Compliance hooks:** Tenant export job (writes to time-limited signed S3 URL); cryptographic delete (rotate per-tenant DEK + drop). Both implemented as BullMQ jobs in Phase 11; surfaced as endpoints in Phase 13.

---

## Part 8 — Cross-Cutting Concerns

### Testing strategy
- **Unit (Vitest):** `authz`, `tenant`, `billing`, `scim` packages each ≥ 90% coverage on policy code.
- **Integration:** Spin Compose with a single `app-db` and run Prisma migrations + seed; assertions hit real Postgres + Redis.
- **E2E (Playwright):** login flow, tenant isolation, billing upgrade, SCIM provision-then-login.
- **Load (k6):** target SLOs — p95 `/api/notes` < 150 ms at 200 RPS per tenant.
- **Chaos (light):** kill workers mid-job; ensure no double-processing.

### Definition of Done (per feature)
- Code, tests, docs, observability (logs/metrics/traces), authz check, audit log entry, RLS verified, migration reversible, `_ready` probe still green.

### What we deliberately defer
- Realm-per-tenant Keycloak (single-realm with claims is enough for v1).
- Multi-region active-active (active-passive first).
- A plugin/marketplace API (revisit after 5+ in-tree integrations).
- A custom policy DSL (keep ABAC in TypeScript for now; consider OPA later).

---

## Part 9 — Quick Reference: Phase Order at a Glance

| # | Phase | Adds container(s) | Adds package(s) |
|---|---|---|---|
| 0 | Repo & tooling | traefik (whoami) | — |
| 1 | Keycloak | keycloak, keycloak-db | — |
| 2 | Next.js hello | web | apps/web |
| 3 | Traefik + TLS | (configures) | — |
| 4 | App DB + Prisma | app-db | db |
| 5 | Auth.js + OIDC | — | auth |
| 6 | Tenant + RLS | — | tenant |
| 7 | RBAC/ABAC | — | authz |
| 8 | Redis | redis | — |
| 9 | Logging + audit | — | logger |
| 10 | Observability | grafana, loki, tempo, prometheus, otel-col | observability |
| 11 | Workers | workers | jobs |
| 12 | Stripe | stripe-cli | billing |
| 13 | SCIM | — | scim |
| 14 | White-label | — | (extends ui, notifications) |
| 15 | Security hardening | — | — |
| 16 | Kubernetes / Helm | — | infra/helm |
| 17 | CI/CD | — | .github |

---

## Part 10 — Suggested First Three Days

- **Day 1:** Phase 0 + Phase 1 (repo + Keycloak running, you can log in to admin).
- **Day 2:** Phase 2 + Phase 3 (Next.js hello world reachable at `https://app.lvh.me`).
- **Day 3:** Phase 4 + Phase 5 (real DB, real login against Keycloak, `/me` shows your token).

After day 3 you have a working *authenticated* skeleton. Everything from there is enrichment — tenant isolation, authz, observability, billing, SCIM — each in its own short, testable phase.
