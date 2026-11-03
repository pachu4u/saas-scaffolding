# Ops Notes — Riogentix SaaS Platform

Written for: any future Claude Code session or agent picking up infra/ops work on this
platform, so it doesn't have to re-derive this from scratch. Last updated 2026-11-03
after a live incident + fix (see Incident Log at the bottom) and setting up a manual
deploy pipeline (see CI/CD section).

**No secrets are stored in this file on purpose.** It documents _where_ credentials
live and how to get/rotate them, never the values themselves — this file may be read
by many tools/sessions and could end up copied somewhere less careful.

## The two repos

### 1. `riogentix` — the OSS app

- Local path: `/Users/prab/Git/riogentix`
- GitHub: `riogentix-ai/riogentix` (per `render.yaml`)
- Visual workflow builder: Python/FastAPI backend (`riogentix-base`), React/TS
  frontend, `lfx` executor CLI. See its own `AGENTS.md`/`CLAUDE.md` for dev commands.
- **Multi-tenant model**: every tenant gets its own dedicated backend+frontend
  instance (a pod) — a single Riogentix instance never serves more than one tenant.
  SaaS-integration code lives in `src/backend/base/riogentix/services/saas_*.py` and
  `api/v1/saas_internal.py` / `saas_public.py` / `saas_sso.py`.
- There's also a **standalone single-VM Terraform deploy path**
  (`deploy/terraform/stackit/`) — this is unrelated to the production multi-tenant
  setup below. It was used for a separate demo/test deployment at
  `riogentix.techhanker.com` on VM `188.34.69.107` (key `~/.ssh/id_ed25519`).
  **Don't confuse this with the production control-plane VM** (`213.17.22.54`,
  different key, documented below).

### 2. `saas-stackit` / `saas-scaffolding` — the control plane

- Main checkout: `/Users/prab/Git/pachu4u/saas-scaffolding` (branch
  `fix/local-dev-stack-bugs`)
- Git worktree: `/Users/prab/Git/pachu4u/saas-stackit` (branch
  `infra/stackit-domain-config` — **this is the branch actually running in
  production**, and the one CI auto-deploys from)
- GitHub remote: `https://github.com/pachu4u/saas-scaffolding.git` (a fork — this is
  where CI and its secrets live, not necessarily the canonical upstream)
- Stack: Next.js 15 (`apps/web`) + BullMQ workers (`apps/workers`) + Prisma/Postgres +
  Keycloak (OIDC) + Redis + Traefik/Caddy edge + k3s (for per-tenant riogentix pods)
- Architecture doc: `PROJECT_DETAILS.md` at repo root — some of it is stale/generic
  (written against an example `techhanker.com` dev domain; production is
  `riogentix.com`, see below)
- `docs/infra/tenant-provisioner.md` explains the k3s tenant-provisioning worker: two
  deployments of `apps/workers` exist (a docker-compose one that's a legacy no-op
  fallback, and the real one running as `Deployment/saas-workers` in k3s namespace
  `saas-platform`) — don't confuse them.

## Production domains

- `saas.riogentix.com` — control plane (Next.js web app: marketing, platform admin,
  sign-in)
- `auth.riogentix.com` — Keycloak (realm `saas-platform`)
- `{slug}.riogentix.com` — a tenant's subdomain. Root path (`/`) serves the SaaS tile
  picker; `/app` and `/api/v1/*` route straight to that tenant's own Riogentix pod in
  k3s, bypassing the Next.js app entirely (see `infra/compose/traefik/dynamic/
riogentix-tenants.yml` in saas-scaffolding)
- `admin.{slug}.riogentix.com` — dedicated tenant-admin subdomain (same content as
  `{slug}.riogentix.com/admin`, routed straight to the Next.js app)

## Production VM

One single host runs **both** the docker-compose control-plane stack **and** k3s
(for per-tenant Riogentix pods).

- IP: `213.17.22.54`, user `ubuntu`
- SSH: `ssh -i ~/.ssh/saas_vm_access ubuntu@213.17.22.54`
- Control-plane repo checkout on the VM: `/opt/saas-platform/repo`
  - **This checkout has its own local uncommitted changes** (Traefik dynamic
    configs, a tls-ask route) independent of what's in git — diff before overwriting
    anything, don't blindly force-push or discard.
- Compose directory: `/opt/saas-platform/repo/infra/compose`
- Compose files there:
  - `docker-compose.yml` — base file with **dev-oriented placeholder values**
    (`techhanker.com` domains, local example secrets). **Never deploy with this
    alone.**
  - `docker-compose.stackit.yml` — the **production overlay**. Sets the real
    `riogentix.com` domains/secrets and points `web`/`workers` at the CI-built Harbor
    image (`image: registry.onstackit.cloud/saas-platform/...:latest`) instead of a
    local build.
  - `docker-compose.observability.yml`, `docker-compose.tools.yml`,
    `docker-compose.dev-override.yml` — not needed for a prod web/workers redeploy.
- **Always deploy with both files layered, explicitly**:
  ```bash
  cd /opt/saas-platform/repo/infra/compose
  sudo docker compose -f docker-compose.yml -f docker-compose.stackit.yml pull web workers
  sudo docker compose -f docker-compose.yml -f docker-compose.stackit.yml up -d --force-recreate web workers
  ```
  Running plain `docker compose up` (no `-f docker-compose.stackit.yml`) silently
  falls back to the dev placeholder env and **breaks production auth** — see Incident
  Log #3. There's no `COMPOSE_FILE` default set anywhere, so the `-f` flags must be
  typed every time.
- `DATABASE_URL` for `web`/`workers` points at a **managed STACKIT PostgresFlex
  instance reached over the network** (`*.postgresql.eu01.onstackit.cloud`), not a
  local container. A local `app-db` container only exists if someone runs the base
  compose file without the overlay by mistake (see Incident Log #3). If they turn up
  again: `ssh -i ~/.ssh/saas_vm_access ubuntu@213.17.22.54 "sudo docker stop app-db
redis && sudo docker rm app-db redis"` — confirm first via `docker exec web
printenv REDIS_URL`/`DATABASE_URL` that web/workers don't actually point at them
  (they shouldn't; both are managed STACKIT services over the network).
- k3s (per-tenant Riogentix pods): `sudo k3s kubectl -n t-<tenant-slug> get pods` —
  each tenant gets namespace `t-<slug>` (e.g. `t-test-corporation-3`).

## StackIT Cloud

- Service-account key (JSON) at `~/Documents/stackit_key` on this machine — used with
  the `stackit` CLI (`/opt/homebrew/bin/stackit`, v0.65.0, installed via brew:
  `stackit config set --service-account-key-path <path>`).
  org_id/project_id weren't independently confirmed in this doc — check the key
  file's own `projectId` field or the StackIT console.
- Harbor container registry: https://registry.onstackit.cloud/harbor/projects
  - Project `saas-platform` → `web`, `workers` images (built by saas-scaffolding CI)
  - Project `riogentix` → `riogentix-backend`/`riogentix-frontend` tenant images
    (built by riogentix's own `stackit-tenant-image.yml` workflow, consumed by the
    k3s tenant-provisioning worker)
  - **Auth: use a robot account** (Project → Robot Accounts), not a personal
    account's "CLI secret." A CLI secret is tied to an OIDC ID token that expires
    unless the person keeps logging into the Harbor UI — this silently broke CI once
    already (Incident Log #2). Current working robot account:
    `robot$saas-platform+admin` (token lives in GitHub Actions secrets, see below —
    not written here).

## CI/CD

### Build vs. deploy are separate — on purpose

Neither pipeline below auto-deploys on push. This is deliberate: one shared
production VM, no staging environment, no automatic rollback — a human should
choose when new code actually goes live, not every merge.

### Control plane (`web` / `workers`)

- GitHub Actions on `pachu4u/saas-scaffolding` (`gh run list --repo
pachu4u/saas-scaffolding`)
- **Build** (`.github/workflows/stackit-images.yml`) — triggers automatically on
  push to `main` or `infra/stackit-domain-config`; builds + pushes `web`/`workers`
  images to `registry.onstackit.cloud/saas-platform/*:latest`. Secrets: repo
  Settings → Secrets and variables → Actions → `STACKIT_HARBOR_USERNAME` /
  `STACKIT_HARBOR_PASSWORD` — must be a robot account (see above), not a personal
  login.
- **Deploy** (`.github/workflows/stackit-deploy.yml`, "STACKIT Deploy" in the
  Actions tab) — **manual only** (`workflow_dispatch`, no push trigger). Exists on
  both `main` (required — GitHub only lists/dispatches `workflow_dispatch`
  workflows that exist on the default branch) and `infra/stackit-domain-config`.
  SSHes into the VM and runs the exact two `docker compose -f ... -f
docker-compose.stackit.yml pull/up` commands from the Production VM section
  above. Needs three secrets: `STACKIT_VM_HOST`, `STACKIT_VM_USER`,
  `STACKIT_VM_SSH_KEY` (the VM's private key — already set as of 2026-11-03).
  Optionally scope it under a GitHub Environment named `production` with required
  reviewers for a second manual approval gate.

### Tenant instances (riogentix per-tenant pods)

- The `riogentix` repo has its own workflow,
  `.github/workflows/stackit-tenant-image.yml` — **build only**, triggers
  automatically on push to `main`, pushes
  `registry.onstackit.cloud/riogentix/riogentix-backend:latest`. No deploy step
  exists for this at all yet (unlike the control plane above, which at least has a
  manual one).
- **New tenants** automatically get whatever is currently tagged `:latest` in
  Harbor — provisioning (see below) always creates a brand-new pod, which pulls
  fresh.
- **Existing tenants do not get updated automatically, ever.** Kubernetes doesn't
  watch the registry; `imagePullPolicy: Always` only re-pulls when a pod is
  (re)created, not continuously. A new image pushed to Harbor sits there until
  someone manually runs something like `kubectl rollout restart deployment -n
t-<slug>` for each tenant that should pick it up. There's no workflow for this
  yet — if you want one, it'd be a `workflow_dispatch` job (analogous to STACKIT
  Deploy) that SSHes in and runs that rollout-restart, either for one tenant slug
  or looped across all `t-*` namespaces.

### How a new tenant's riogentix instance actually gets deployed

Traced through `apps/workers/src/provisioning/kubernetes-driver.ts`. Registering a
tenant in the SaaS admin enqueues a BullMQ job picked up by `saas-workers` (the
k3s-deployed worker — see `docs/infra/tenant-provisioner.md`). Its `provision()`:

1. **Build spec** — generates/reuses per-tenant secrets
   (`RIOGENTIX_INTERNAL_SECRET`, `RIOGENTIX_SAAS_INTERNAL_SECRET`,
   `RIOGENTIX_SUPERUSER_PASSWORD`); image = `env.RIOGENTIX_IMAGE`
   (`registry.onstackit.cloud/riogentix/riogentix-backend:latest`, confirmed
   empirically).
2. **`ensureTenantDatabase`** — creates a dedicated Postgres database for this
   tenant on a shared admin instance (`TENANT_PG_ADMIN_URL`) — one DB per tenant,
   not shared.
3. **`registerTenantWithKeycloak`** — creates the Keycloak client config for the
   tenant's host.
4. **`ensureTenantWildcardDns`** — provisions DNS (Cloudflare or IONOS driver).
5. **`ensureTenantTraefikRouter`** — writes that tenant's dedicated Traefik dynamic
   config file (`infra/compose/traefik/dynamic/tenant-<slug>.yml`).
6. **`applyManifests`** — server-side-applies the k8s objects (Namespace
   `t-<slug>`, Secret, Deployment, Service, Ingress, RoleBinding) via
   `manifests.ts`.
7. **`waitForDeploymentReady`** — polls up to 10 minutes for `readyReplicas >= 1`.
8. **`provisionInstanceTenant`** — POSTs to the freshly-running pod's own
   `/internal/tenant/{id}/provision` endpoint to initialize the tenant inside that
   Riogentix instance (DB migrations/seed).

Result (`publicUrl` + SCIM endpoint) is stored back as that tenant's
`ConnectedAppInstance` record — the thing the SSO launch flow
(`apps/web/src/app/api/riogentix-launch/route.ts`) checks for before letting a user
into the tenant's app.

## This machine's Claude Code permission notes

`~/.claude/settings.json` (global, this machine) has an `autoMode.allow` list with
entries scoped to `ubuntu@213.17.22.54` + `~/.ssh/saas_vm_access` covering both
SSH/SCP _writes_ (docker build/push, compose up/restart, file copies) and _reads_
(config/credential files, DB/Vault queries) on that one host. These had to be added
by the human user — a Claude session cannot grant itself this (editing its own
classifier rules is a hard, self-modification boundary it can't cross regardless of
instruction). If a future session hits a "Remote Shell Writes" / "Production Reads"
block on this same VM and the rule seems to have gone missing, that's the file to
check.

## Known test/seed accounts

- Platform admin: `admin@platform.test` — ask the user/team for the current
  password; not stored here.

## Incident log

**2026-11-03 — `test-corporation-3.riogentix.com` admin console hung 30–120+s**
for a platform admin without membership in that tenant (symptom: "keeps loading
forever" after login). Root cause: the STACKIT-managed Postgres instance
intermittently closes pooled Prisma connections out from under the app (`web`
container logs: `prisma:error Error in PostgreSQL connection: Error { kind: Closed,
cause: None }`), and recovering mid-request took 30–120+s instead of failing fast.
Made worse by `getCurrentTenant()` being called twice per request across nested
layouts (`apps/web/src/app/t/layout.tsx` and `t/[slug]/admin/layout.tsx`). Fixed in
commit `b8eb8ec` on `infra/stackit-domain-config`:

- `packages/db/src/client.ts` — pin `connect_timeout`/`pool_timeout=10s` on the
  Postgres connection URL so a bad connection fails fast and retries, instead of
  hanging.
- `apps/web/src/lib/server-tenant.ts` — wrap `getCurrentTenant`/
  `getActiveMemberships` in React's `cache()` so nested layouts share one DB round
  trip per request instead of two.

**2026-11-03 — CI's Harbor login started failing (`unauthorized`)**, unrelated to
the above. Root cause: `STACKIT_HARBOR_USERNAME`/`PASSWORD` held a personal Harbor
account's OIDC "CLI secret," which expires without regular UI logins. Fixed by
switching to robot account `robot$saas-platform+admin`.

**2026-11-03 — redeploying `web`/`workers` with a plain `docker compose up
--force-recreate` (missing `-f docker-compose.stackit.yml`)** silently reverted
production to the dev placeholder env (`techhanker.com` domains), breaking login
platform-wide for a few minutes until caught and fixed. Also left two stray, unused
local containers (`app-db`, `redis`) running on the VM — **still need cleanup** as of
this writing.
