# User Acceptance Test Plan — Riogentix SaaS Platform

Written for: whoever signs off a release (or an agent/session asked to verify one).
Business-readable test cases for every critical user journey, each marked with
whether it's already automated and where.

**Two test suites, two environments** — this matters, read it before running anything:

| Suite                                 | Environment                        | Config                     | What it can (and can't) prove                                                                                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/e2e/tests/*.spec.ts` (existing) | Local dev (`app.lvh.me`)           | `playwright.config.ts`     | Feature-level UI behavior, fast and deterministic (many API calls are mocked). **Cannot** exercise real tenant-subdomain routing, real Keycloak cross-domain SSO, or real k3s pod provisioning — local dev is single-tenant.                                                               |
| `apps/e2e/tests/uat/*.spec.ts` (new)  | **Production** (`*.riogentix.com`) | `playwright.uat.config.ts` | The things the table above can't: cross-subdomain routing/isolation, the real SSO handoff into a tenant's actual Riogentix pod, and the latency regression this plan exists partly because of. Runs against real infrastructure — read "Running against production" below before using it. |

## Personas

- **Anonymous** — no session
- **Platform Admin** — `admin@platform.test`, Keycloak group `platform_super_admin`
- **Tenant Admin** — a user with an admin/owner role binding inside one specific tenant
- **Tenant User** — a user with a plain membership in one specific tenant, no admin role

## Running against production

The new `uat/` suite hits real `*.riogentix.com` domains with a real browser and a
real (seeded test) admin login. It's read-mostly by design (no test writes/deletes
tenants), but:

- Use a dedicated, disposable test tenant slug (`UAT_TENANT_SLUG` env var) — never a
  real customer tenant.
- Don't run it on every commit / in a tight loop — it's hitting production Keycloak
  and the real control plane.
- `BASE_URL`/`AUTH_URL`/`UAT_TENANT_SLUG` are all env-configurable; see
  `playwright.uat.config.ts`.

---

## 1. Authentication & Session

| ID      | Case                                                                                                    | Priority | Automated?                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| UAT-101 | Platform admin signs in via Keycloak SSO, lands on `/admin`                                             | P0       | ✅ `tests/auth.spec.ts`                                                                                        |
| UAT-102 | Tenant user signs in, lands on their tenant workspace                                                   | P0       | ✅ `tests/auth.spec.ts`                                                                                        |
| UAT-103 | Sign out clears session and redirects to sign-in                                                        | P0       | ✅ `tests/auth.spec.ts`                                                                                        |
| UAT-104 | Wrong password shows an inline error, no redirect                                                       | P1       | ✅ `tests/auth.spec.ts`                                                                                        |
| UAT-105 | A stale/corrupt session cookie self-heals (cleared, user re-prompted to sign in, not stuck in a loop)   | P1       | ⬜ Not automated — see `middleware.ts`'s `clearSessionCookies`; worth a dedicated case if this regresses again |
| UAT-106 | Session persists across the tenant's own subdomain and the root domain (cookie domain `.riogentix.com`) | P0       | 🆕 `tests/uat/cross-tenant-security.spec.ts`                                                                   |

## 2. Tenant Onboarding & Provisioning

| ID      | Case                                                                                                                                                                | Priority | Automated?                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| UAT-201 | Platform admin completes the 5-step onboarding wizard (Workspace → Invite → Branding → Billing → Done)                                                              | P0       | ✅ `tests/onboarding.spec.ts`                                                  |
| UAT-202 | Workspace step validates required name and slug format                                                                                                              | P1       | ✅ `tests/onboarding.spec.ts`                                                  |
| UAT-203 | A newly created tenant shows `provisioningStatus` progressing to a terminal state on `/admin/tenants/{id}`                                                          | P0       | ✅ `tests/provisioning.spec.ts`                                                |
| UAT-204 | **A newly provisioned tenant's Riogentix instance is actually reachable** (`/api/v1/version` on `{slug}.riogentix.com` returns 200) within the provisioning timeout | P0       | 🆕 `tests/uat/cross-tenant-security.spec.ts` (manual/scripted; see note below) |
| UAT-205 | Provisioning failure is surfaced with `provisioningError` text, not a silent hang                                                                                   | P1       | ⬜ Not automated                                                               |

_Note on UAT-204: exercising this fully (create → provision → verify pod reachable)
is expensive and mutates production (creates a real tenant/pod/DNS record/Keycloak
client). Treat as a manual pre-release check, or automate only against a disposable
staging environment if one exists — the included spec only asserts against the
pre-existing `UAT_TENANT_SLUG` fixture, it does not provision a fresh tenant._

## 3. Platform Admin Console

| ID          | Case                                                                                                                                                                                                                                                              | Priority                                              | Automated?                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| UAT-301     | `/admin` overview shows global stats (Total Tenants, Users, Active Jobs, Paid Plans)                                                                                                                                                                              | P1                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| UAT-302     | `/admin` shows System Health panel (Web, Database, Vault)                                                                                                                                                                                                         | P1                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| UAT-303     | Tenant list: search, plan filter, pagination render correctly                                                                                                                                                                                                     | P1                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| UAT-304     | Tenant detail page shows Status/Plan/Members/Audit Events + Provisioning + Recent Activity sections                                                                                                                                                               | P1                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| UAT-305     | Suspend / reinstate a tenant from the admin console                                                                                                                                                                                                               | P0                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| UAT-306     | Jobs admin page renders BullMQ queue depths                                                                                                                                                                                                                       | P2                                                    | ✅ `tests/admin-tenant.spec.ts`              |
| **UAT-307** | **A platform admin with no membership in a given tenant, visiting that tenant's own subdomain (`{slug}.riogentix.com/admin`), is redirected to the real platform console (`saas.riogentix.com/admin`) — and this resolves in a few seconds, not 30–120+ seconds** | **P0 — regression guard for the 2026-11-03 incident** | 🆕 `tests/uat/cross-tenant-security.spec.ts` |

## 4. Tenant Admin Console

| ID      | Case                                                     | Priority | Automated?                   |
| ------- | -------------------------------------------------------- | -------- | ---------------------------- |
| UAT-401 | Team page: invite a member, see pending invite           | P1       | ✅ `tests/team.spec.ts`      |
| UAT-402 | Role management: change a member's role                  | P1       | ✅ `tests/team.spec.ts`      |
| UAT-403 | Settings: general/branding/security tabs render and save | P1       | ✅ `tests/settings.spec.ts`  |
| UAT-404 | Billing: plan selection and Stripe checkout redirect     | P1       | ✅ `tests/billing.spec.ts`   |
| UAT-405 | Webhooks: endpoint CRUD and delivery log display         | P2       | ✅ `tests/webhooks.spec.ts`  |
| UAT-406 | Audit log: entries display and filter correctly          | P2       | ✅ `tests/audit.spec.ts`     |
| UAT-407 | Dashboard: stats, activity feed, quick actions render    | P2       | ✅ `tests/dashboard.spec.ts` |

## 5. Tenant Workspace & Riogentix App Access

| ID          | Case                                                                                                                                                                                                                                       | Priority | Automated?                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UAT-501     | Tile picker (`/t/{slug}`) shows "Riogentix App" tile, and "Admin Panel" tile only for admins                                                                                                                                               | P1       | ⬜ Not automated (local dev is single-tenant, can't exercise the real tile picker meaningfully)                                                                            |
| **UAT-502** | **Clicking "Riogentix App" performs the SSO token handoff (`/api/riogentix-launch` → tenant's `/api/v1/internal/saas/sso`) and lands the user authenticated inside their actual tenant pod — not Riogentix's own default-superuser login** | **P0**   | 🆕 Manual pre-release check (see note) — not in the automated spec; it mutates session cookies on the tenant's own domain in a way worth a human watching once per release |
| UAT-503     | Tenant branding (logo, colors) applied correctly on the tile picker and sign-in page                                                                                                                                                       | P2       | ⬜ Not automated                                                                                                                                                           |

## 6. Cross-Tenant Security & Isolation 🆕

Entirely new section — none of this is exercisable against local dev, and none of it
existed as a documented acceptance criterion before the 2026-11-03 incident.

| ID      | Case                                                                                                                                                                                                                                        | Priority | Automated?                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| UAT-307 | _(see section 3)_ Platform admin on a foreign tenant's subdomain → redirected to platform console, fast                                                                                                                                     | P0       | 🆕 `tests/uat/cross-tenant-security.spec.ts`                                                                   |
| UAT-601 | Anonymous visitor to any tenant subdomain is redirected to that tenant's sign-in page (never shown tenant data)                                                                                                                             | P0       | 🆕 `tests/uat/cross-tenant-security.spec.ts`                                                                   |
| UAT-602 | A tenant user's session is **not** accepted as proof of membership in a _different_ tenant's subdomain merely because the cookie is shared platform-wide — see `getCurrentTenant`'s membership check in `apps/web/src/lib/server-tenant.ts` | P0       | ⬜ Not automated — needs two seeded test users in two different tenants; worth adding once such fixtures exist |
| UAT-603 | Public branding endpoint (`/internal/saas/branding`, resolved by `Host` header) returns 200 with only the public branding fields, for any host, no auth required                                                                            | P1       | 🆕 `tests/uat/cross-tenant-security.spec.ts`                                                                   |

## 7. Performance & Reliability Acceptance Criteria 🆕

Direct regression guards for the 2026-11-03 Prisma connection-stale incident —
without these, the exact failure mode (a request _working_ but hanging 30–120+
seconds) would ship undetected again, since a plain up/down health check would never
catch it.

| ID      | Case                                                                                                                                                                                                 | Priority | Automated?                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- | ---------------------------------------- |
| UAT-701 | `GET /admin` on any tenant subdomain, as an authenticated user, completes in under a fixed budget (5s) — not merely "eventually 200s"                                                                | **P0**   | 🆕 `tests/uat/cross-tenant-security.spec.ts`                    |
| UAT-702 | `GET /api/v1/version` on a tenant subdomain (bypasses the Next.js app entirely, hits the tenant's own Riogentix pod) completes in under 1s                                                           | P1       | 🆕 `tests/uat/cross-tenant-security.spec.ts`                    |
| UAT-703 | The `web` container's logs show no `prisma:error Error in PostgreSQL connection: Error { kind: Closed` entries newer than the last deploy (if there are, `connect_timeout`/`pool_timeout` regressed) | P2       | ⬜ Manual: `ssh ... "sudo docker logs web --since <deploy-time> | grep 'kind: Closed'"`— see`OPS_NOTES.md` |

## 8. Public / Unauthenticated Endpoints

| ID      | Case                                                                            | Priority | Automated?                                               |
| ------- | ------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| UAT-801 | `/api/v1/version` on a tenant subdomain responds 200 with version info, no auth | P1       | 🆕 `tests/uat/cross-tenant-security.spec.ts` (= UAT-702) |
| UAT-802 | `/internal/saas/branding` responds 200 for any host, no auth                    | P1       | 🆕 `tests/uat/cross-tenant-security.spec.ts` (= UAT-603) |

---

## How to run

```bash
# Existing dev-targeted suite (local dev stack must be running)
cd apps/e2e
pnpm test                              # all projects/browsers
pnpm test tests/admin-tenant.spec.ts   # one file

# New production-targeted UAT suite
UAT_TENANT_SLUG=<a-disposable-test-tenant-slug> \
  npx playwright test --config playwright.uat.config.ts
```
