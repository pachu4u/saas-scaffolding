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

## ðŸŸ¢ Polish

### P-1 Â· Empty states for all tables

- **Files:** team/members, audit, webhooks, jobs pages
- **Add:** Illustrated empty state with CTA when table has 0 rows.

### P-2 Â· Loading skeletons

- **Add:** `loading.tsx` per route segment â€” skeleton cards while RSC data fetches.

### P-3 Â· Mobile-responsive sidebar

- **Add:** Hamburger button in topbar on `<lg` screens â†’ slide-in drawer overlay.
- **Fix:** `apps/web/src/components/layout/sidebar.tsx` + `topbar.tsx`

### P-4 Â· "Send test email" button

- **New API:** `apps/web/src/app/api/notifications/test/route.ts`
- **Wire into:** Settings â†’ Branding â†’ Email tab.

### P-5 Â· Test webhook delivery button

- **Add:** "Send test" on webhook endpoint row â†’ `POST /api/webhooks/[id]/test`.

### P-6 Â· Data export & compliance

- **New file:** `apps/web/src/app/(dashboard)/settings/compliance/page.tsx`
- **Includes:** "Export all workspace data" (triggers BullMQ job â†’ signed S3 URL) + "Request cryptographic delete" (GDPR).
- **New settings tab:** Add "Compliance" to settings inner nav.

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
