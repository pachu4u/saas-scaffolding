# riogentix — Next Implementation Plan

**Baseline:** Phases 0–17 scaffolded. Backend production-grade. Frontend ~60% wired.  
**Goal:** Close every gap so every user-facing flow works end-to-end.

---

## Priority tiers

| Tier | Label    | Criteria                                                                |
| ---- | -------- | ----------------------------------------------------------------------- |
| 🔴   | Critical | Broken flows or live security issues — fix before any release           |
| 🟠   | High     | Core product functionality missing — needed for an internal beta        |
| 🟡   | Medium   | Completeness & operator experience — needed for GA                      |
| 🟢   | Polish   | Quality-of-life and mobile — nice for GA, required before public launch |

---

## 🔴 Critical

### C-1 · Lock down `/api/tenants` ✅

- **File:** `apps/web/src/app/api/tenants/route.ts`
- **Problem:** Unauthenticated GET returns every tenant in the database. Live security issue.
- **Fix:** Require platform-admin session; return 401 otherwise.
- **Acceptance:** `curl /api/tenants` without auth → 401. With platform-admin session → 200.

### C-2 · Enforce tenant suspension in middleware ✅

- **File:** `apps/web/src/middleware.ts`
- **Problem:** `tenants.status = SUSPENDED` is stored but never checked; suspended tenants still get full access.
- **Fix:** After tenant lookup, if `status !== ACTIVE` redirect to `/suspended`.
- **New page:** `apps/web/src/app/suspended/page.tsx` — full-screen locked notice.
- **Acceptance:** Suspend a tenant in DB → all subsequent requests redirect to suspension page.

### C-3 · Error & loading shell pages ✅

- **Files:** `apps/web/src/app/not-found.tsx`, `error.tsx`, `loading.tsx`, `(dashboard)/loading.tsx`
- **Problem:** Unhandled errors → blank page. Missing routes → Next.js default 404.
- **Fix:** Branded pages for all three states.
- **Acceptance:** Navigate to `/nonexistent` → branded 404. Throw error in RSC → branded error page.

### C-4 · Invitation acceptance flow ✅

- **New files:**
  - `apps/web/src/app/invite/[token]/page.tsx` — accept/decline UI
  - `apps/web/src/app/api/team/invite/route.ts` — POST (send invite), GET by token
  - `apps/web/src/app/api/team/invite/[token]/accept/route.ts` — POST accept
- **Problem:** Members land in status `INVITED` with no way to accept. Invite flow is end-to-end broken.
- **Fix:** Server action sends email with signed token; acceptance page validates token and flips `TenantUserStatus` to `ACTIVE`.
- **Acceptance:** Invite flow works from "Invite member" click through to member appearing as Active.

### C-5 · Invite modal + role assignment modal ✅

- **Files:**
  - `apps/web/src/components/modals/invite-modal.tsx`
  - `apps/web/src/components/modals/change-role-modal.tsx`
- **Problem:** "Invite member" and "Edit role" buttons exist but open nothing.
- **Fix:** Client-side modal components wired via server actions.
- **Acceptance:** Both modals open, submit, and show success/error feedback.

---

## 🟠 High

### H-1 · Stripe Checkout + Customer Portal wiring ✅

- **New files:**
  - `apps/web/src/app/api/billing/checkout/route.ts` — creates Stripe Checkout session
  - `apps/web/src/app/api/billing/portal/route.ts` — creates Stripe Customer Portal session
- **Wire into:** billing page "Upgrade" and "Manage subscription" buttons.
- **Acceptance:** Clicking Upgrade → redirects to Stripe-hosted Checkout. Manage → Customer Portal.

### H-2 · Webhook management page + API ✅

- **New files:**
  - `apps/web/src/app/(dashboard)/webhooks/page.tsx` — endpoint list, delivery history
  - `apps/web/src/app/api/webhooks/route.ts` — GET list, POST create
  - `apps/web/src/app/api/webhooks/[id]/route.ts` — GET, PATCH, DELETE
  - `apps/web/src/app/api/webhooks/[id]/deliveries/route.ts` — GET delivery history
- **Sidebar:** add Webhooks nav item.
- **Acceptance:** Create endpoint → delivery attempt recorded → retry visible in UI.

### H-3 · Profile / account settings page ✅

- **New file:** `apps/web/src/app/(dashboard)/profile/page.tsx`
- **New API:** `apps/web/src/app/api/users/me/route.ts` — PATCH (name, avatar)
- **Includes:** Display name, avatar upload, active sessions list (from Redis), revoke session.
- **Acceptance:** Change display name → persisted to DB → sidebar reflects new name.

### H-4 · Jobs / DLQ admin page ✅

- **New file:** `apps/web/src/app/(admin)/admin/jobs/page.tsx`
- **New API:** `apps/web/src/app/api/admin/jobs/route.ts` — GET queue depths + failed jobs
- **Includes:** Per-queue counts (pending/active/failed), DLQ entries, retry button.
- **Acceptance:** Enqueue a job that fails 3× → appears in DLQ → retry button re-queues it.

### H-5 · Platform admin user management ✅

- **New file:** `apps/web/src/app/(admin)/admin/users/page.tsx`
- **Includes:** Cross-tenant user search, per-user audit log, suspend/reinstate, tenant membership list.
- **Acceptance:** Search "alice" → see all tenants alice belongs to + last activity.

### H-6 · Revenue analytics (admin) ✅

- **New file:** `apps/web/src/app/(admin)/admin/revenue/page.tsx`
- **Includes:** MRR over time (bar chart), plan distribution, new tenants per month, churn.
- **Acceptance:** Chart renders with non-zero data points.

### H-7 · SCIM Groups endpoint ✅

- **New file:** `apps/web/src/app/scim/v2/Groups/route.ts`
- **Extends:** `packages/scim/src/groups.ts`
- **Includes:** GET list, POST create, PATCH (add/remove members), DELETE.
- **Acceptance:** Okta SCIM provisioner push group → members appear in tenant.

### H-8 · Usage rollup persistence ✅

- **Fix:** `apps/workers/src/handlers/usage-rollup.ts` — write aggregated rows instead of logging.
- **New API:** `apps/web/src/app/api/usage/route.ts` — GET time-series usage per kind.
- **Acceptance:** After rollup job runs → `/api/usage` returns non-empty array.

---

## 🟡 Medium

### M-1 · Wire all "Save" server actions ✅

- **Branding page:** color scheme, logo, email settings, login page copy → `PATCH /api/tenants/branding`
- **Security page:** session policy, MFA toggle, IP allowlist → `PATCH /api/tenants/security`
- **Notifications:** per-event toggles → `PATCH /api/users/me/notifications`
- **Acceptance:** Save branding → refresh page → changes persisted.

### M-2 · Onboarding wizard ✅

- **New file:** `apps/web/src/app/(dashboard)/onboarding/page.tsx`
- **Steps:** (1) Workspace name & logo → (2) Invite first member → (3) Configure SSO or skip → (4) Set up webhook or skip → (5) Done
- **Trigger:** Show on first login when `tenant.onboarding_completed = false`.
- **Acceptance:** New tenant completes wizard → redirected to dashboard → checklist marked done.

### M-3 · Tenant suspension banner ✅

- **New file:** `apps/web/src/app/suspended/page.tsx`
- **Includes:** Branded full-screen message with contact info and admin email.
- **Acceptance:** Suspended tenant → every route → suspension page.

### M-4 · Session expiry graceful redirect ✅

- **Fix:** `apps/web/src/middleware.ts` — on expired token, clear cookie and redirect to `/auth/signin?reason=expired`.
- **Fix:** `apps/web/src/app/auth/signin/page.tsx` — show "Your session expired, please sign in again" when `reason=expired`.
- **Acceptance:** Manually expire session cookie → next navigation → sign-in page with expiry message (not blank/401).

### M-5 · IP allowlist management UI ✅

- **Extend:** `apps/web/src/app/(dashboard)/settings/security/page.tsx`
- **Add:** CIDR input + list of current ranges when IP allowlist toggle is on.
- **New API:** `apps/web/src/app/api/tenants/security/route.ts`
- **Acceptance:** Add `203.0.113.0/24` → saved → request from outside range → 403.

### M-6 · Workspace switcher ✅

- **Fix:** `apps/web/src/components/layout/sidebar.tsx` workspace dropdown
- **New API:** `apps/web/src/app/api/users/me/workspaces/route.ts` — list tenants the user belongs to
- **Acceptance:** User in 2 tenants → click switcher → list of workspaces → click one → navigate to `[slug].lvh.me`.

### M-7 · Custom role creation form ✅

- **New file:** `apps/web/src/components/modals/create-role-modal.tsx`
- **New API:** `apps/web/src/app/api/roles/route.ts` — POST create
- **Wire into:** "Create custom role" card on `/team/roles`.
- **Acceptance:** Enter name + description → select permissions → save → new role card appears.

---

## 🟢 Polish

### P-1 · Empty states for all tables

- **Files:** team/members, audit, webhooks, jobs pages
- **Add:** Illustrated empty state with CTA when table has 0 rows.

### P-2 · Loading skeletons

- **Add:** `loading.tsx` per route segment — skeleton cards while RSC data fetches.

### P-3 · Mobile-responsive sidebar

- **Add:** Hamburger button in topbar on `<lg` screens → slide-in drawer overlay.
- **Fix:** `apps/web/src/components/layout/sidebar.tsx` + `topbar.tsx`

### P-4 · "Send test email" button

- **New API:** `apps/web/src/app/api/notifications/test/route.ts`
- **Wire into:** Settings → Branding → Email tab.

### P-5 · Test webhook delivery button

- **Add:** "Send test" on webhook endpoint row → `POST /api/webhooks/[id]/test`.

### P-6 · Data export & compliance

- **New file:** `apps/web/src/app/(dashboard)/settings/compliance/page.tsx`
- **Includes:** "Export all workspace data" (triggers BullMQ job → signed S3 URL) + "Request cryptographic delete" (GDPR).
- **New settings tab:** Add "Compliance" to settings inner nav.

---

## Implementation sequence

```
Week 1:  C-1 → C-2 → C-3 → C-4 → C-5           (critical, ~1 day each)
Week 2:  H-1 → H-2 → H-3 → H-7                  (Stripe, webhooks, profile, SCIM)
Week 3:  H-4 → H-5 → H-6 → H-8                  (admin ops, revenue, usage)
Week 4:  M-1 → M-2 → M-3 → M-4 → M-5 → M-6 → M-7  (wiring + medium features)
Week 5:  P-1 → P-2 → P-3 → P-4 → P-5 → P-6     (polish sprint)
```

---

## Definition of Done (per item)

- [ ] Feature works end-to-end in the browser against real services (not mocks)
- [ ] Server action / API route protected by `withAuthz()` with correct permission
- [ ] Mutation writes to `audit_log`
- [ ] Optimistic UI or loading state shown during async operations
- [ ] Empty state handled (no blank tables)
- [ ] Responsive at ≥375px viewport
- [ ] No TypeScript errors (`pnpm typecheck` green)
- [ ] `pnpm lint` green
