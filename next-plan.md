# riogentix â€” Next Implementation Plan

**Baseline:** Phases 0â€“17 scaffolded. Backend production-grade. Frontend ~60% wired.  
**Goal:** Close every gap so every user-facing flow works end-to-end.

---

## Priority tiers

| Tier | Label    | Criteria                                                                  |
| ---- | -------- | ------------------------------------------------------------------------- |
| ðŸ”´ | Critical | Broken flows or live security issues â€” fix before any release           |
| ðŸŸ  | High     | Core product functionality missing â€” needed for an internal beta        |
| ðŸŸ¡ | Medium   | Completeness & operator experience â€” needed for GA                      |
| ðŸŸ¢ | Polish   | Quality-of-life and mobile â€” nice for GA, required before public launch |

---

## ðŸ”´ Critical

### C-1 Â· Lock down `/api/tenants` âœ…

- **File:** `apps/web/src/app/api/tenants/route.ts`
- **Problem:** Unauthenticated GET returns every tenant in the database. Live security issue.
- **Fix:** Require platform-admin session; return 401 otherwise.
- **Acceptance:** `curl /api/tenants` without auth â†’ 401. With platform-admin session â†’ 200.

### C-2 Â· Enforce tenant suspension in middleware âœ…

- **File:** `apps/web/src/middleware.ts`
- **Problem:** `tenants.status = SUSPENDED` is stored but never checked; suspended tenants still get full access.
- **Fix:** After tenant lookup, if `status !== ACTIVE` redirect to `/suspended`.
- **New page:** `apps/web/src/app/suspended/page.tsx` â€” full-screen locked notice.
- **Acceptance:** Suspend a tenant in DB â†’ all subsequent requests redirect to suspension page.

### C-3 Â· Error & loading shell pages âœ…

- **Files:** `apps/web/src/app/not-found.tsx`, `error.tsx`, `loading.tsx`, `(dashboard)/loading.tsx`
- **Problem:** Unhandled errors â†’ blank page. Missing routes â†’ Next.js default 404.
- **Fix:** Branded pages for all three states.
- **Acceptance:** Navigate to `/nonexistent` â†’ branded 404. Throw error in RSC â†’ branded error page.

### C-4 Â· Invitation acceptance flow âœ…

- **New files:**
  - `apps/web/src/app/invite/[token]/page.tsx` â€” accept/decline UI
  - `apps/web/src/app/api/team/invite/route.ts` â€” POST (send invite), GET by token
  - `apps/web/src/app/api/team/invite/[token]/accept/route.ts` â€” POST accept
- **Problem:** Members land in status `INVITED` with no way to accept. Invite flow is end-to-end broken.
- **Fix:** Server action sends email with signed token; acceptance page validates token and flips `TenantUserStatus` to `ACTIVE`.
- **Acceptance:** Invite flow works from "Invite member" click through to member appearing as Active.

### C-5 Â· Invite modal + role assignment modal âœ…

- **Files:**
  - `apps/web/src/components/modals/invite-modal.tsx`
  - `apps/web/src/components/modals/change-role-modal.tsx`
- **Problem:** "Invite member" and "Edit role" buttons exist but open nothing.
- **Fix:** Client-side modal components wired via server actions.
- **Acceptance:** Both modals open, submit, and show success/error feedback.

---

## ðŸŸ  High

### H-1 Â· Stripe Checkout + Customer Portal wiring âœ…

- **New files:**
  - `apps/web/src/app/api/billing/checkout/route.ts` â€” creates Stripe Checkout session
  - `apps/web/src/app/api/billing/portal/route.ts` â€” creates Stripe Customer Portal session
- **Wire into:** billing page "Upgrade" and "Manage subscription" buttons.
- **Acceptance:** Clicking Upgrade â†’ redirects to Stripe-hosted Checkout. Manage â†’ Customer Portal.

### H-2 Â· Webhook management page + API âœ…

- **New files:**
  - `apps/web/src/app/(dashboard)/webhooks/page.tsx` â€” endpoint list, delivery history
  - `apps/web/src/app/api/webhooks/route.ts` â€” GET list, POST create
  - `apps/web/src/app/api/webhooks/[id]/route.ts` â€” GET, PATCH, DELETE
  - `apps/web/src/app/api/webhooks/[id]/deliveries/route.ts` â€” GET delivery history
- **Sidebar:** add Webhooks nav item.
- **Acceptance:** Create endpoint â†’ delivery attempt recorded â†’ retry visible in UI.

### H-3 Â· Profile / account settings page âœ…

- **New file:** `apps/web/src/app/(dashboard)/profile/page.tsx`
- **New API:** `apps/web/src/app/api/users/me/route.ts` â€” PATCH (name, avatar)
- **Includes:** Display name, avatar upload, active sessions list (from Redis), revoke session.
- **Acceptance:** Change display name â†’ persisted to DB â†’ sidebar reflects new name.

### H-4 Â· Jobs / DLQ admin page âœ…

- **New file:** `apps/web/src/app/(admin)/admin/jobs/page.tsx`
- **New API:** `apps/web/src/app/api/admin/jobs/route.ts` â€” GET queue depths + failed jobs
- **Includes:** Per-queue counts (pending/active/failed), DLQ entries, retry button.
- **Acceptance:** Enqueue a job that fails 3Ã— â†’ appears in DLQ â†’ retry button re-queues it.

### H-5 Â· Platform admin user management âœ…

- **New file:** `apps/web/src/app/(admin)/admin/users/page.tsx`
- **Includes:** Cross-tenant user search, per-user audit log, suspend/reinstate, tenant membership list.
- **Acceptance:** Search "alice" â†’ see all tenants alice belongs to + last activity.

### H-6 Â· Revenue analytics (admin) âœ…

- **New file:** `apps/web/src/app/(admin)/admin/revenue/page.tsx`
- **Includes:** MRR over time (bar chart), plan distribution, new tenants per month, churn.
- **Acceptance:** Chart renders with non-zero data points.

### H-7 Â· SCIM Groups endpoint âœ…

- **New file:** `apps/web/src/app/scim/v2/Groups/route.ts`
- **Extends:** `packages/scim/src/groups.ts`
- **Includes:** GET list, POST create, PATCH (add/remove members), DELETE.
- **Acceptance:** Okta SCIM provisioner push group â†’ members appear in tenant.

### H-8 Â· Usage rollup persistence âœ…

- **Fix:** `apps/workers/src/handlers/usage-rollup.ts` â€” write aggregated rows instead of logging.
- **New API:** `apps/web/src/app/api/usage/route.ts` â€” GET time-series usage per kind.
- **Acceptance:** After rollup job runs â†’ `/api/usage` returns non-empty array.

---

## ðŸŸ¡ Medium

### M-1 Â· Wire all "Save" server actions âœ…

- **Branding page:** color scheme, logo, email settings, login page copy â†’ `PATCH /api/tenants/branding`
- **Security page:** session policy, MFA toggle, IP allowlist â†’ `PATCH /api/tenants/security`
- **Notifications:** per-event toggles â†’ `PATCH /api/users/me/notifications`
- **Acceptance:** Save branding â†’ refresh page â†’ changes persisted.

### M-2 Â· Onboarding wizard âœ…

- **New file:** `apps/web/src/app/(dashboard)/onboarding/page.tsx`
- **Steps:** (1) Workspace name & logo â†’ (2) Invite first member â†’ (3) Configure SSO or skip â†’ (4) Set up webhook or skip â†’ (5) Done
- **Trigger:** Show on first login when `tenant.onboarding_completed = false`.
- **Acceptance:** New tenant completes wizard â†’ redirected to dashboard â†’ checklist marked done.

### M-3 Â· Tenant suspension banner âœ…

- **New file:** `apps/web/src/app/suspended/page.tsx`
- **Includes:** Branded full-screen message with contact info and admin email.
- **Acceptance:** Suspended tenant â†’ every route â†’ suspension page.

### M-4 Â· Session expiry graceful redirect âœ…

- **Fix:** `apps/web/src/middleware.ts` â€” on expired token, clear cookie and redirect to `/auth/signin?reason=expired`.
- **Fix:** `apps/web/src/app/auth/signin/page.tsx` â€” show "Your session expired, please sign in again" when `reason=expired`.
- **Acceptance:** Manually expire session cookie â†’ next navigation â†’ sign-in page with expiry message (not blank/401).

### M-5 Â· IP allowlist management UI âœ…

- **Extend:** `apps/web/src/app/(dashboard)/settings/security/page.tsx`
- **Add:** CIDR input + list of current ranges when IP allowlist toggle is on.
- **New API:** `apps/web/src/app/api/tenants/security/route.ts`
- **Acceptance:** Add `203.0.113.0/24` â†’ saved â†’ request from outside range â†’ 403.

### M-6 Â· Workspace switcher âœ…

- **Fix:** `apps/web/src/components/layout/sidebar.tsx` workspace dropdown
- **New API:** `apps/web/src/app/api/users/me/workspaces/route.ts` â€” list tenants the user belongs to
- **Acceptance:** User in 2 tenants â†’ click switcher â†’ list of workspaces â†’ click one â†’ navigate to `[slug].lvh.me`.

### M-7 Â· Custom role creation form âœ…

- **New file:** `apps/web/src/components/modals/create-role-modal.tsx`
- **New API:** `apps/web/src/app/api/roles/route.ts` â€” POST create
- **Wire into:** "Create custom role" card on `/team/roles`.
- **Acceptance:** Enter name + description â†’ select permissions â†’ save â†’ new role card appears.

---

## 🟢 Polish

### P-1 · Empty states for all tables ✅

- **Files:** team/members, audit, webhooks, jobs pages
- **Add:** Illustrated empty state with CTA when table has 0 rows.
- **Status:** Webhooks and jobs/DLQ already had real empty + loading states. Added the
  actual gap — `DataTable` gained an `emptyState` slot (icon/title/description/CTA,
  distinct from the plain `emptyMessage` text shown for filtered-to-zero results), wired
  into `team-members-table.tsx` with an "Invite member" CTA. Audit log keeps its plain
  text message — an empty audit log has no actionable CTA.

### P-2 · Loading skeletons ✅

- **Add:** `loading.tsx` per route segment — skeleton cards while RSC data fetches.
- **Status:** `(dashboard)/loading.tsx` already existed. The real gap was `(admin)`
  having **no** `loading.tsx` at all — added one (table-shaped skeleton, matches most
  admin pages).

### P-3 · Mobile-responsive sidebar ✅

- **Add:** Hamburger button in topbar on `<lg` screens → slide-in drawer overlay.
- **Fix:** `apps/web/src/components/layout/sidebar.tsx` + `topbar.tsx`
- **Status:** New `sidebar-context.tsx` (`SidebarProvider`/`useSidebar`) shares
  open/close state between `Topbar` (hamburger trigger) and `Sidebar` (off-canvas drawer
  - backdrop on `<lg`, always visible `≥lg`). Both `(dashboard)` and `(admin)` layouts
    wrapped in the provider; content margin and loading skeletons changed from a fixed
    `ml-60` to responsive `lg:ml-[var(--sidebar-width)]`. Verified in a real browser at
    375px (drawer off-canvas, hamburger visible, opens on tap) and 1440px (always visible,
    no hamburger).

### P-4 · "Send test email" button ✅

- **New API:** `apps/web/src/app/api/notifications/test/route.ts`
- **Wire into:** Settings → Branding → Email tab.
- **Status:** Button existed with no `onClick` at all. Wired to the new route, which
  uses the existing `@platform/notifications` `sendEmail()` abstraction (console.log
  fallback in dev without a real Resend key — pre-existing behavior, unchanged).

### P-5 · Test webhook delivery button ✅ (already done)

- **Add:** "Send test" on webhook endpoint row → `POST /api/webhooks/[id]/test`.
- **Status:** Found already fully implemented (button, API route, inline success/error
  feedback) — no work needed.

### P-6 · Data export & compliance ✅

- **New file:** `apps/web/src/app/(dashboard)/settings/compliance/page.tsx`
- **Includes:** "Export all workspace data" + "Request cryptographic delete" (GDPR).
- **New settings tab:** Added "Compliance" to settings inner nav.
- **Scope change from spec:** the original spec called for a BullMQ job → signed S3 URL.
  This stack has no object storage configured anywhere (no S3/MinIO client, no bucket
  config) — fabricating that would mean a non-functional feature pointing at infra that
  doesn't exist. Implemented instead as a direct synchronous JSON download
  (`GET /api/settings/compliance/export`), which is real and works today. Secrets
  (webhook signing keys, SCIM tokens, API keys) are deliberately excluded from the
  export. "Cryptographic delete" records an audited request
  (`POST /api/settings/compliance/delete-request`) rather than instantly wiping data
  from a single unconfirmed click — matches how this actually works at most SaaS
  vendors (reviewed/actioned by a human, not instant self-service).

### P-7 · `/admin/activity` page (found during testing, not in original spec) ✅

- **New file:** `apps/web/src/app/(admin)/admin/activity/page.tsx`
- **Problem:** Sidebar already linked to `/admin/activity`; page didn't exist → 404.
- **Fix:** Cross-tenant audit log viewer (last 500 events, searchable), built on the
  existing generic `DataTable`.

### P-8 · `/admin/settings` page (found during testing, not in original spec) ✅

- **New file:** `apps/web/src/app/(admin)/admin/settings/page.tsx`
- **Problem:** Sidebar already linked to `/admin/settings`; page didn't exist → 404.
- **Fix:** There's no `PlatformSettings` DB table, so this isn't a form of editable
  values that wouldn't persist anywhere — it's a real, honest "Environment &
  Operations" page: live env info (`NODE_ENV`, build SHA, Keycloak issuer, tenant/user/job
  counts) plus shortcut links to Keycloak admin, Grafana, Traefik dashboard, and
  `/admin/jobs`.

---

## 🔨 Session log — bugs found while standing up the local stack (2026-06-25)

Not in the original plan — found and fixed while getting `pnpm dev:up` to actually run
end-to-end for the first time. Branch `fix/local-dev-stack-bugs`, commit `834c1a4`:

- **`web.Dockerfile`** — `next build` runs `@platform/config`'s eager zod env
  validation during the image build, before `docker-compose`'s env vars exist. Added
  build-time placeholders (overridden at container runtime as already documented in the
  runner stage).
- **`docker-compose.{observability,tools}.yml`** — incorrect `external: true` on the
  `platform` network broke the documented one-command `pnpm dev:up` (merges all three
  compose files; Compose then requires the network to pre-exist).
- **`schema.prisma`** — missing `linux-musl-arm64-openssl-3.0.x` Prisma binary target;
  `workers` crash-looped on Apple Silicon.
- **`0002_rls_grants` migration** — a prior "idempotent" fix only guarded the
  `tenant_users` policy; the other 11 tables' `CREATE POLICY` statements had no
  `DROP POLICY IF EXISTS`, so re-running the migration still failed.
- **`0004_native_status_enums` (new migration)** — 7 status columns are typed as Prisma
  `enum` in `schema.prisma` but `0001_init` implemented them as `TEXT + CHECK`. Prisma's
  postgresql client always casts to a native enum type by name for `enum` fields, so
  every query against those columns failed with `type "TenantStatus" does not exist`
  etc. Converted to real native enums, matching the pattern `0003_provisioning` already
  used correctly.
- **`tempo-config.yml` + compose** — outdated `overrides` schema for the pinned Tempo
  2.5.0, plus running as root since the named volume is root-owned and the image's
  non-root user can't `mkdir` under it.
- **`packages/auth/config.ts`** — the `signIn` event only ever upserted the bare `User`
  row; despite a comment documenting that Keycloak `groups` should map to tenant slugs,
  it never created the `TenantUser` membership. Every fresh SSO login had zero tenant
  membership, which made `/dashboard` redirect to `/` (no tenant) — and middleware
  redirect any authenticated user on `/` straight back to `/dashboard`. Infinite loop.
  Now JIT-provisions `TenantUser` + a default `tenant_user` `RoleBinding` from the
  `groups` claim on sign-in.
- **`realm-export.json`** — `platform-admin` had a `platform_super_admin` **realm role**
  but no matching Keycloak **group** (a different concept — the app checks group
  membership via `session.groups`, not realm roles). Same redirect-loop symptom as
  above, specific to the platform-admin account. Added the group, assigned membership
  (also applied directly to the already-running realm via Keycloak's Admin API, since
  realm import only happens once at first boot).

---

## 🔨 Session log — lint cleanup + missing test suites (2026-06-26)

Per the Definition of Done at the bottom of this doc, `pnpm lint` should be green and
every package should have tests — neither was true. Commit `1e3a512` on
`fix/local-dev-stack-bugs`:

- **`pnpm lint`**: was broadly red across nearly every package (hundreds of violations,
  strict typescript-eslint rules never satisfied). Ran `eslint --fix` repo-wide first,
  then fixed the remaining ~100 by hand. Now **14/14 packages green**. Most fixes were
  mechanical (import order, `String(n)` instead of bare numbers in template literals,
  dead `?? fallback` after an unsafe `as T` cast that hid a real possibly-undefined
  value — fixed by casting to `T | undefined` instead of deleting the fallback). A few
  were real bugs, not style nits:
  - `DataTable`'s search/sort used `String(v ?? '')` on an `unknown` cell value — for
    any non-primitive value this silently produces `"[object Object]"` and corrupts
    sort/search results. Added a `toComparable()` helper that returns `''` for
    non-primitives instead.
  - Same bug class in `@platform/notifications`'s template substitution — a
    non-primitive template variable would have silently rendered `"[object Object]"`
    in an outgoing email body.
  - `POST /api/webhooks` accepted _any_ string as an event type — the `WEBHOOK_EVENTS`
    whitelist existed but was never actually checked against. Wired it in.
  - `apps/workers`'s "graceful shutdown" was aspirational: `Worker` instances were
    never kept, so SIGTERM/SIGINT hard-killed in-flight jobs instead of letting them
    finish. Now collects the workers and awaits `worker.close()` on each.
  - The notes page had a `quota` usage-bar UI block reading from a `setQuota` that was
    never called anywhere (the API never returned quota data). Removed the dead
    feature rather than leave a permanently-inert UI block in place.
  - A handful of `as any` / non-null-assertion casts were masking legitimate runtime
    fallback paths (SCIM PatchOp body, branding JSON fields, Keycloak profile claims).
    Fixed by typing the cast honestly (`T | undefined`) so the existing `??` fallback
    means something to the type checker, instead of deleting the safety net to satisfy
    the linter.
  - A couple of casts are genuine upstream type-incompatibilities (BullMQ's generic
    `Queue.add` name param, OpenTelemetry `sdk-node`/`sdk-metrics` version skew) — kept
    as-is, with an explanatory comment instead of a bare disable.
  - NextAuth callbacks and Next.js Server Actions must stay `async` even with no real
    `await` — this is a framework requirement, confirmed the hard way via an actual
    failed Docker build (`Error: Server Actions must be async functions`) after
    initially removing `async` to satisfy `require-await`. Reverted and suppressed the
    rule there specifically instead.
- **Missing test suites**: `@platform/billing`, `@platform/tenant`, and `@platform/scim`
  had a `test` script wired to Vitest but zero test files — `pnpm test` failed
  immediately. Added 49 new tests across 7 files:
  - `billing`: plan-tier invariants (`PLAN_FEATURES`), Stripe webhook idempotency,
    status mapping, and tenant-scoped subscription upsert/cancel behavior.
  - `tenant`: subdomain slug extraction (reserved names, case, ports, invalid chars),
    Redis-cached tenant resolution (cache hit/miss/failure paths, soft-delete
    handling), and `AsyncLocalStorage`-based context isolation across concurrent
    requests.
  - `scim`: token authentication (Bearer parsing, hash-based lookup, tenant-slug
    cross-check), User/Group SCIM mapping, and idempotent user provisioning.
- **Verified end-to-end**: `pnpm lint` (14/14), `pnpm typecheck` (27/27), `pnpm test`
  (16/16, 66 tests) all green repo-wide. Rebuilt the `web` and `workers` Docker images
  and re-ran the real OAuth login flow through an actual browser for alice, bob, and
  platform-admin — all three land cleanly with zero console or HTTP errors.

Commit `749f22f` on the same branch covers the Polish-tier work above (P-1–P-8).

---

## 🔨 Session log — e2e suite repair (2026-06-26)

The Playwright suite (`apps/e2e`, 106 tests) was almost entirely non-functional: only
3/106 passing. Commit `ae8c5bb` on `fix/local-dev-stack-bugs` gets it to **106/106
(105 passed, 1 legitimate skip)**.

- **Root cause #1 — wrong test credentials.** `helpers/auth.ts` hardcoded
  `admin@platform.test`/`admin` and a non-existent `user@acme.test`/`password`, and
  never clicked "Continue with SSO" before trying to fill the Keycloak form. Fixed to
  the real seeded accounts (`platform123` / `alice@acme.test` + `alice123`) and added
  the missing click. This alone took the suite from 3 → 53 passing.
- **Root cause #2 — Playwright locators default to case-insensitive substring
  matching**, not exact. This caused two failure modes throughout nearly every spec
  file: strict-mode violations (a regex like `/view/i` also matching sidebar
  "Overview", or `/webhook/i` also matching an empty-state heading "No webhook
  endpoints") and silently-wrong matches. Fixed file-by-file with `{ exact: true }` or
  `.first()` depending on intent, plus corrected a bunch of assertions that assumed
  UI copy that didn't match the real components (placeholder text, button labels,
  `getByRole('dialog')` on modals that are plain styled `<div>`s with no ARIA role,
  and a non-existent `toBeOneOf` matcher used throughout → `toContain`).
- **Root cause #3 — unauthenticated API requests redirect, they don't 401.**
  Middleware sends a 307 to `/auth/signin` for any unauthenticated request to a
  protected route. Playwright's `request` fixture follows redirects by default, which
  replays the original method (POST/PATCH/GET) onto the sign-in _page_ — a route that
  only supports GET — producing a misleading 405. Fixed by passing `maxRedirects: 0`
  on every unauthenticated `request.*()` call in the suite and accepting 307 as an
  expected status, instead of chasing the downstream 405.
- **Root cause #4 — load-induced flakiness, not a bug.** A batch of `settings.spec.ts`
  tests intermittently hit 30s `networkidle` timeouts under the default 4-worker
  parallel run. Reproduced the same page load in isolation (no concurrent load): ~1s.
  Re-running with `--workers=2` eliminated the flakiness entirely — this stack's
  single shared Postgres/Next.js instance doesn't have the headroom for 4-way
  concurrent E2E load. No test or product code changed for this one.
- **Two real product bugs found and fixed along the way:**
  - The "Edit role" button in the team members table (`team-members-table.tsx`) had
    **no `onClick` handler at all** — `ChangeRoleModal` existed in the codebase but
    was never wired in. Added `editingMember` state and rendered the modal on click.
  - `PATCH /api/team/members/[userId]/role` **never existed**, even though
    `change-role-modal.tsx` already called it. Added the route, following the
    existing `roleId`-is-actually-a-role-name convention from `team/invite/route.ts`.
  - Both required rebuilding the `web` Docker image — it's a production build with no
    source volume mount, so editing `apps/web/src` doesn't take effect until
    `pnpm dev:up` rebuilds and recreates the container.
- One test (`webhook deliveries page renders for a valid endpoint`) skips
  legitimately: there's no seeded webhook endpoint to navigate to from a fresh DB.

---

## Implementation sequence

```
Week 1:  C-1 â†’ C-2 â†’ C-3 â†’ C-4 â†’ C-5           (critical, ~1 day each)
Week 2:  H-1 â†’ H-2 â†’ H-3 â†’ H-7                  (Stripe, webhooks, profile, SCIM)
Week 3:  H-4 â†’ H-5 â†’ H-6 â†’ H-8                  (admin ops, revenue, usage)
Week 4:  M-1 â†’ M-2 â†’ M-3 â†’ M-4 â†’ M-5 â†’ M-6 â†’ M-7  (wiring + medium features)
Week 5:  P-1 â†’ P-2 â†’ P-3 â†’ P-4 â†’ P-5 â†’ P-6     (polish sprint)
```

---

## Definition of Done (per item)

- [ ] Feature works end-to-end in the browser against real services (not mocks)
- [ ] Server action / API route protected by `withAuthz()` with correct permission
- [ ] Mutation writes to `audit_log`
- [ ] Optimistic UI or loading state shown during async operations
- [ ] Empty state handled (no blank tables)
- [ ] Responsive at â‰¥375px viewport
- [ ] No TypeScript errors (`pnpm typecheck` green)
- [ ] `pnpm lint` green
