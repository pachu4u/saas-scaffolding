# Admin App Test Plan — Platform Admin + Tenant Admin

Every screen, button, link, and behavior across both admin surfaces of the control
plane: the **platform admin console** (`/admin/*`, platform-operator-only) and
**each tenant's own admin console** (`/t/{slug}/admin/*`, tenant-admin-only).
Cross-referenced against the existing `apps/e2e/tests/*.spec.ts` suite (local dev,
`app.lvh.me`) so nothing gets re-tested twice. Gaps found while building this are
now covered by `apps/e2e/tests/admin-platform-gaps.spec.ts` and
`apps/e2e/tests/admin-tenant-gaps.spec.ts` (new, added alongside this plan).

## How to read this

- ✅ = already automated, file + test names given
- 🆕 = new, added in this pass (`admin-platform-gaps.spec.ts` /
  `admin-tenant-gaps.spec.ts`)
- 📝 = documented here, not automated (reason given — usually because it needs a
  seeded fixture this suite doesn't set up, e.g. a second platform-admin account to
  test grant/revoke)

---

## Part A — Platform Admin Console (`/admin/*`)

Gated to Keycloak groups `platform_super_admin` / `platform_support`; a
non-platform-admin visiting any of these is redirected away (see
`auth.spec.ts`'s "redirects unauthenticated users from admin pages", and the
2026-11-03 incident fix in `t/layout.tsx` for the no-membership case).

### A1. `/admin` — Overview ✅ `admin-tenant.spec.ts`

| #   | Element / behavior                                                       | Case                                                                                      |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | Stat cards: Total Tenants, Total Users, Active Jobs, Paid Plans          | "admin overview shows global stats"                                                       |
| 2   | System Health panel: Web (Next.js), Database (Postgres), HashiCorp Vault | "admin overview shows system health panel"                                                |
| 3   | "Manage" link per tenant row                                             | "Manage link points to individual tenant" (asserts `/admin/tenants/{uuid}`, not the list) |

### A2. `/admin/tenants` — Tenant list ✅ `admin-tenant.spec.ts`

| #   | Element / behavior                                                          | Case                                                  |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Heading, subtitle, search input, plan-filter combobox, "Create Tenant" link | "tenant list page renders"                            |
| 2   | "View" button per row → tenant detail                                       | "tenant list — View button links to tenant detail"    |
| 3   | "Create Tenant" → `/onboarding`                                             | "create tenant button links to the onboarding wizard" |

### A3. `/admin/tenants/[id]` — Tenant detail ✅ `admin-tenant.spec.ts`, `provisioning.spec.ts`, `audit.spec.ts`

| #   | Element / behavior                                                                                                                                       | Case                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Overview cards: Status, Plan, Members, Audit Events                                                                                                      | "tenant detail page shows all sections"                        |
| 2   | Sections: Tenant Details, Provisioning, Recent Activity                                                                                                  | same                                                           |
| 3   | Suspend button → `PATCH`, page refresh                                                                                                                   | "suspend button calls API and refreshes page"                  |
| 4   | Provisioning panel: environment toggle, provision button, env endpoints after completion                                                                 | `provisioning.spec.ts` (7 cases)                               |
| 5   | Audit entries show resource info                                                                                                                         | `audit.spec.ts` "...in admin tenant detail show resource info" |
| 📝  | Reinstate button (suspend's counterpart) — only `admin-tenant.spec.ts` tests suspend; reinstate on an already-suspended tenant isn't separately asserted | needs a pre-suspended fixture tenant                           |

### A4. `/admin/jobs` — Job queues ✅ `admin-tenant.spec.ts`

| #   | Element / behavior                                                   | Case                                                                      |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | "Job Queues" heading, "BullMQ queue depths" subtitle, Refresh button | "jobs page renders queue list"                                            |
| 📝  | Refresh button actually re-fetches queue depths (not just renders)   | not asserted — worth a case if this page gets a loading/error state later |

### A5. `/admin/activity` — Platform-wide activity 🆕

Cross-tenant audit log, last 500 events, no filters visible in the page itself (data
comes pre-sorted/limited server-side; `ActivityTable` client component handles
rendering — its own interactive controls, if any, are a sub-component gap this plan
flags but doesn't implement, since the component file wasn't read).
| # | Element / behavior | Case |
|---|---|---|
| 1 | Topbar title "Platform Activity", subtitle "Cross-tenant audit log — last 500 events" | 🆕 `platform activity page renders` |
| 2 | Table/empty-state renders without erroring when there are 0 or N logs | 🆕 same test, tolerant assertion |
| 📝 | `ActivityTable`'s own sort/filter/pagination controls (if any) | not read; add if that component grows interactive controls |

### A6. `/admin/connected-apps` — Connected apps list 🆕

| #   | Element / behavior                                              | Case                                                                          |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Topbar title "Connected Apps", subtitle, breadcrumb `Admin`     | 🆕 `connected apps list renders`                                              |
| 2   | "Create" action button (`CreateConnectedAppButton`) visible     | 🆕 same                                                                       |
| 3   | Table shows id/slug/name/status/instanceCount/roleCount per app | 🆕 same, tolerant of 0 rows                                                   |
| 📝  | Clicking a row navigates to `/admin/connected-apps/{id}`        | not asserted directly here — covered indirectly by A7 existing via direct nav |

### A7. `/admin/connected-apps/[id]` — Connected app detail 🆕

| #   | Element / behavior                                                                                                       | Case                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | "← Back to Connected Apps" link → `/admin/connected-apps`                                                                | 🆕 `connected app detail — back link`              |
| 2   | "App configuration" section (`ConnectedAppConfigForm`)                                                                   | 🆕 `connected app detail shows all three sections` |
| 3   | "Tenant instances (N)" section (`ConnectedAppInstancesTable`) — lists only tenants NOT yet connected as available-to-add | same                                               |
| 4   | "App-specific roles" section (`ConnectedAppRolesPanel`)                                                                  | same                                               |
| 5   | 404 for a non-existent app id                                                                                            | 🆕 `connected app detail — unknown id 404s`        |

### A8. `/admin/plans` — Plans & Riogentix features 🆕

Static reference page (no DB-backed table rows beyond the hardcoded `FEATURES`
list) — mostly a read-only doc page, but still gated to platform admin.
| # | Element / behavior | Case |
|---|---|---|
| 1 | Heading "Plans & Riogentix Features" | 🆕 `plans page renders feature matrix` |
| 2 | Feature matrix table: 6 feature rows × Free/Pro/Enterprise columns, check/dash icons | same |
| 3 | "How it works" explanation section | same |
| 4 | Non-platform-admin visiting `/admin/plans` is redirected to `/dashboard` | 🆕 `plans page redirects non-platform-admins` |

### A9. `/admin/revenue` — Revenue analytics 🆕

| #   | Element / behavior                                            | Case                                            |
| --- | ------------------------------------------------------------- | ----------------------------------------------- |
| 1   | 4 stat cards: MRR, ARR (est.), Paid tenants, Total workspaces | 🆕 `revenue page renders stat cards and charts` |
| 2   | "New workspaces per month" bar chart (6 months)               | same                                            |
| 3   | "Plan distribution" bars (free/pro/enterprise)                | same                                            |
| 4   | "Active subscriptions" list or empty state                    | same                                            |
| 5   | Non-platform-admin redirected to `/dashboard`                 | 🆕 `revenue page redirects non-platform-admins` |

### A10. `/admin/roles` — Platform roles & permissions 🆕

| #   | Element / behavior                                                                                                                  | Case                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Role cards: Platform Super Admin, Platform Support, each with permission-count badge                                                | 🆕 `platform roles page renders role cards and matrix`                                                                     |
| 2   | Explanatory banner naming the two Keycloak groups; text changes based on `canManage` (only `platform_super_admin` can grant/revoke) | same, plus 🆕 `non-super-admin sees read-only roles copy`                                                                  |
| 3   | Permission matrix table (grouped by resource, check/x per role per permission)                                                      | same test as #1                                                                                                            |
| 4   | `PlatformRoleMembers` grant/revoke controls, gated by `canManage`                                                                   | 📝 needs a second platform-admin test identity to safely exercise grant/revoke without touching the primary seeded account |

### A11. `/admin/users` — Platform user management 🆕

Fully client-rendered (`'use client'`), debounced search (350ms), expandable rows.
| # | Element / behavior | Case |
|---|---|---|
| 1 | Heading "User Management", live user count in subtitle | 🆕 `users page renders and searches` |
| 2 | Search input filters by email (debounced `GET /api/admin/users?q=`) | same test, waits past debounce |
| 3 | "Add user" button opens `AddPlatformUserModal` | 🆕 `add user modal opens and closes` |
| 4 | Row click expands to show workspace memberships + user ID | 🆕 `user row expands to show workspace memberships` |
| 5 | Suspend/Reinstate button per row (`PATCH /api/admin/users`), success message, list refreshes | 📝 mutates a real user — needs a disposable fixture user, not run against a real admin account |
| 6 | Loading skeleton (8 pulsing rows) while fetching | 📝 timing-dependent, low value to automate |
| 7 | Empty state: "No users found" (+ query echoed when searching) | 🆕 covered by the search case using a near-certainly-empty query |

### A12. `/admin/settings` — Platform settings

📝 **Not read in this pass** — file exists (`apps/web/src/app/(admin)/admin/settings/page.tsx`) but wasn't opened; add a dedicated section once its contents are reviewed. Flagging explicitly rather than silently skipping.

---

## Part B — Tenant Admin Console (`/t/{slug}/admin/*`)

Gated to a tenant-scoped admin/billing-admin role binding; a platform admin without
membership in this specific tenant is redirected to the platform console instead
(the 2026-11-03 regression — see `apps/e2e/tests/uat/cross-tenant-security.spec.ts`).

### B1. `/t/{slug}/admin` — Tenant dashboard ✅ `dashboard.spec.ts`

17 cases already cover: 4 stat cards, usage chart, recent activity, 4 quick actions
(Invite/Billing/SSO navigation), plan banner, sidebar, topbar email, and the
`/api/usage` endpoint. No gaps found.

### B2. `/t/{slug}/admin/team` + `/team/roles` + `/team/roles/[id]` ✅ `team.spec.ts`

12 cases: member rows, invite modal (open/close/send/validate), roles list, role
detail, change-role modal, invite-accept token flow, `/api/team/invite` validation.

### B3. `/t/{slug}/admin/settings` (+ `branding`, `security`, `api-keys`) ✅ `settings.spec.ts`

11 cases cover general/branding/security/API-keys tabs and their PATCH endpoints.

### B4. `/t/{slug}/admin/settings/compliance` — GDPR export/delete 🆕

Not covered by `settings.spec.ts` at all — a distinct page under the same nav, not
one of the four tabs that spec exercises.
| # | Element / behavior | Case |
|---|---|---|
| 1 | "Export workspace data" card, button triggers `GET /api/settings/compliance/export`, downloads a file (explicitly excludes secrets per its own copy) | 🆕 `compliance page — export button triggers download` |
| 2 | "Request cryptographic delete" card (red-bordered, destructive styling) | 🆕 `compliance page renders both cards` |
| 3 | Delete button → `POST /api/settings/compliance/delete-request` → success state "✓ Deletion request submitted", button replaced (not re-clickable) | 📝 **destructive** — do not automate against a real tenant; document only. If ever automated, must run against a fully disposable fixture tenant. |
| 4 | Error banner renders if either endpoint fails | 🆕 covered via API mock, same pattern as `webhooks.spec.ts`'s modal error cases |

### B5. `/t/{slug}/admin/billing` ✅ `billing.spec.ts`

8 cases: current plan, upgrade→checkout, billing portal, checkout API validation,
webhook endpoint, dashboard plan banner.

### B6. `/t/{slug}/admin/webhooks` ✅ `webhooks.spec.ts`

12 cases: CRUD, modal validation (required/HTTPS-only), delivery log, all 4 REST
endpoints.

### B7. `/t/{slug}/admin/audit` ✅ `audit.spec.ts`

7 cases: entry list/empty-state, action/resource/actor/timestamp columns, filters,
dashboard quick-link.

### B8. `/t/{slug}/admin/hub` — Connected app hub 🆕

Not covered by any existing spec — distinct from `/admin` (dashboard) and `/team`.
| # | Element / behavior | Case |
|---|---|---|
| 1 | 4 stat tiles: Total Members, Active Members, Pending Invites, App Roles | 🆕 `hub page renders stat tiles and panels` |
| 2 | `HubTeamPanel` (members list) with "view all" link → `/admin/team` | same |
| 3 | Connected-app identity card: icon/name/description/docs link, or "No connected app yet" | same |
| 4 | `ConnectedAppScimPanel` (SCIM sync status) — only rendered if a connected app instance exists | 📝 needs a tenant fixture with a connected app to exercise the populated state |
| 5 | Branding snapshot (3 color swatches) + "Customize branding →" link to `/admin/settings/branding` | 🆕 same test, link-only assertion |
| 6 | "App roles at a glance" — top 4 roles by member count, or empty-state copy | 🆕 same test, tolerant of 0 roles |

### B9. `/t/{slug}/admin/profile` — User's own profile 🆕

Distinct from platform `/admin/users` — this is the signed-in user's own account
page, available to any tenant member (not admin-gated), but lives under the admin
tree.
| # | Element / behavior | Case |
|---|---|---|
| 1 | Identity card: avatar upload, editable display name, "Platform admin" badge iff applicable | 🆕 `profile page renders identity card` |
| 2 | Account status / member-since / user ID / workspace-count fields | same |
| 3 | "Sign out" link (×2 — identity card AND Account management section) → `/api/auth/keycloak-logout` | 🆕 `profile page sign-out links point to logout` |
| 4 | "Active sessions" section (currently always empty — `activeSessions` is hardcoded `[]` in the page) | 📝 nothing to assert beyond "renders the empty state" — flagging that this is dead/placeholder data, not a bug, in case it's surprising later |
| 5 | "Workspace memberships" list — tenant name/slug/plan/status per membership, or empty state | 🆕 same test |
| 6 | "Manage your identity account" → opens Keycloak account console in a new tab (`target="_blank"`) | 🆕 `profile page — Keycloak account console link` (href-only, doesn't follow it) |
| 7 | "Developer: raw session token" `<details>` disclosure — expands to show full JSON session | 🆕 `profile page — raw session details expands` |

### B10. Tile picker `/t/{slug}` (bare, pre-admin) 🆕

The one page in this plan that's outside the `/admin` tree entirely but is the
landing point into it. Not covered by any existing spec — `dashboard.spec.ts`
starts from `/t/{slug}/admin` directly.
| # | Element / behavior | Case |
|---|---|---|
| 1 | "Welcome to {tenantName}" heading | 🆕 `tile picker renders welcome heading and riogentix tile` |
| 2 | "Riogentix App" tile always visible, links via `tenantAppUrl(slug)` (the SSO bridge) or a direct `/app` fallback | same |
| 3 | "Admin Panel" tile visible **only** for tenant admins/owners or platform admins — not for plain members | 📝 needs two fixture users (admin vs. plain member) to assert the negative case; the suite only has `TEST_USER_EMAIL` (alice@acme.test), whose role isn't confirmed admin or member in these fixtures |
| 4 | Header shows tenant name + signed-in user's email, "Sign out" link | 🆕 same test |

---

## Summary

|                      | Platform admin (A)                                  | Tenant admin (B)                                                   |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Pages                | 12 (+1 unread: settings)                            | 10 (+1 tile picker)                                                |
| Already automated    | 4 pages, ~20 cases                                  | 7 pages, ~70 cases                                                 |
| New this pass        | 6 pages, ~20 cases                                  | 3 pages + tile picker, ~15 cases                                   |
| Documented-only (📝) | grant/revoke roles, platform user suspend/reinstate | compliance delete-request, hub SCIM panel, tile-picker role-gating |

Every 📝 item is skipped for the same reason class: it either **mutates real
data with no safe fixture to target** (user suspend, cryptographic delete) or
**needs a second seeded identity this suite doesn't have** (a non-super-admin
platform account, a confirmed-non-admin tenant member). None are skipped because
they're hard to write — they're skipped because running them against whatever
tenant/account happens to be seeded risks real side effects. Add the fixtures first,
then automate these.
