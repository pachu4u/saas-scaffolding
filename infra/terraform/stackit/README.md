# saas-scaffolding on STACKIT — Terraform

Provisions a second, independent deployment of this platform on STACKIT
Cloud, under its own domain (`riogentix.com` by default) — separate from
the existing techhanker.com host. One Compute Engine VM runs the _entire_
stack via the same `infra/compose/` files already used locally: Traefik,
oauth2-proxy, Keycloak+DB, app Postgres, Redis, Vault, Web, Workers, plus
k3s (for the tenant-provisioner — see `docs/infra/tenant-provisioner.md`),
fronted by a STACKIT Load Balancer.

```
Internet --TLS(Traefik+Cloudflare DNS-01)--> STACKIT Load Balancer (L4 passthrough, 80/443)
                                                    |
                                          STACKIT Compute Engine VM
                                 docker compose: traefik, oauth2-proxy, keycloak(+db),
                                 app-db, redis, vault, web, workers
                                 k3s: saas-workers (tenant-provisioner)
                                      -> stamps a Riogentix stack per tenant
```

**Nothing here touches the techhanker.com host.** The existing
`infra/compose/docker-compose.yml` and `infra/compose/traefik/**` files are
never edited — this deployment overlays a compose file
(`docker-compose.stackit.yml`, rendered from `templates/docker-compose.stackit.yml.tftpl`)
and replaces the Traefik config files with domain-parameterized renders
(`templates/traefik.yaml.tftpl`, `templates/dynamic-*.yaml.tftpl`) on a
**fresh git checkout on the new VM only**. See `locals.tf` for how
everything is rendered and `templates/bootstrap.sh.tftpl` for exactly what
runs on first boot.

## What you need before running this

1. **An existing STACKIT organization and project** — same as any STACKIT
   Terraform config; create the project via the Portal first.
2. **A service account** with `owner` role on the project, plus its
   downloaded JSON key (`stackit_service_account_key_path`).
3. **An SSH key pair** for VM access (`ssh_public_key_path`), and your own
   IP/CIDR for `ssh_allowed_cidrs`.
4. **A GitHub read-only deploy key** for `pachu4u/saas-scaffolding` (it's
   private): `ssh-keygen -t ed25519 -N '' -f ./stackit-deploy-key`, add the
   `.pub` under repo Settings → Deploy keys (read-only is enough), point
   `git_deploy_key_path` at the private half. **Do not commit it.**
5. **`riogentix.com` as a Cloudflare zone**, plus a Cloudflare API token
   (Zone:DNS:Edit scope on that zone) for `cloudflare_dns_api_token`. Tenant
   subdomains are two levels deep (`app.{slug}.riogentix.com`), which free
   Cloudflare Universal SSL doesn't cover — Traefik's own DNS-01 resolver
   issues those certs, same as the techhanker.com host.
6. **A `riogentix` backend image reference** (`riogentix_image`) — verify
   the tag is current before first apply; this is what the tenant-provisioner
   stamps out per tenant.
7. **Stripe/Resend keys** if you want billing/email live immediately —
   otherwise leave them blank and those features stay disabled until set.

## DNS records to create (after `apply`, pointed at the `load_balancer_ip` output)

| Host                                                                                           | Purpose                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saas.riogentix.com`                                                                           | Main platform app                                                                                                                                                                                                           |
| `auth.riogentix.com`                                                                           | Keycloak                                                                                                                                                                                                                    |
| `*.riogentix.com`                                                                              | Tenant tile pages (wildcard — also covers `oauthproxy.riogentix.com`, the oauth2-proxy fixed callback host)                                                                                                                 |
| `*.<slug>.riogentix.com` per active tenant, or a second-level wildcard if your DNS supports it | `app.`/`admin.` tenant subdomains (see `TENANT_APP_SUBDOMAIN_IP` — the tenant-provisioner also creates these automatically via the Cloudflare API on each tenant provision, so this is mostly a one-time bootstrap concern) |

## What this does NOT do / known gaps

- **Not yet applied or tested end-to-end.** This was authored and validated
  with `terraform validate`, `terraform fmt`, and by rendering every
  template + diffing the merged `docker compose config` output against the
  real base files — but never against a real STACKIT project (no
  credentials available in the environment this was written in). **Run a
  `terraform plan` and review it carefully, then treat the first `apply` as
  a dry run you watch closely** (tail `/var/log/saas-platform-bootstrap.log`
  over SSH while it boots).
- **Self-hosted DB/Redis, not STACKIT managed.** Matches what's live on
  techhanker.com today (lower complexity), but means no managed
  backups/HA — back up the `app-db-data` / `keycloak-db-data` Docker volumes
  yourself if that matters to you.
- **Images build on the VM from a git checkout**, not a registry — first
  boot is slow (pnpm install + full `docker compose build`, budget 15-20
  minutes) and every redeploy needs SSH access, not just a `docker pull`.
- **No seed data.** `scripts/dev.sh`'s `pnpm --filter @platform/db db:seed`
  step is intentionally skipped in `bootstrap.sh` — this is meant to be a
  real environment, not fixtures. Create your first tenant/admin through the
  app itself.
- **`user_data` only runs on first boot.** Changing `terraform.tfvars` after
  the VM exists does not push the new config — see the `rendered_*` outputs
  and the redeploy recipe in `outputs.tf`.
- **`TENANT_APP_SUBDOMAIN_IP` / docker network gateway address
  (`172.18.0.1`) assumed stable.** This matches the convention already
  relied on in the live techhanker.com host's Traefik config, but Docker
  assigns bridge subnets in creation order — run
  `docker network inspect platform | grep Gateway` on the VM after first
  boot and update `infra/k8s/tenant-provisioner/secret.env` (then
  `kubectl -n saas-platform rollout restart deploy/saas-workers`) if it
  differs.
- **Traefik dashboard is inert here on purpose.** `traefik.yml` on this
  deployment (like the techhanker.com host) only enables the `file`
  provider, so the `traefik.*` Docker labels in the base compose file
  (including the dashboard-auth router with its git-visible basicauth hash)
  never take effect. Nothing to disable, but nothing to rely on either — use
  `ssh -L 8080:localhost:8080 ubuntu@<ssh_ip>` + a local `curl` against the
  container's insecure API port if you need the dashboard.
- **Vault runs in dev mode** (`docker-compose.tools.yml`, root token,
  in-memory) — same as local dev. Fine for now since nothing here treats it
  as durable secret storage yet; revisit before anything depends on Vault
  actually persisting.
- **`WORKER_ENABLE_TENANT_PROVISIONING` intentionally left unset** on the
  docker-compose `workers` fleet, matching current techhanker.com behavior —
  see `docs/infra/tenant-provisioner.md` for the shared-vs-kubernetes driver
  split. Not something this change should silently alter.
- **Container Registry / CI build pipeline**: not set up. If you later want
  faster redeploys, add a STACKIT Container Registry (or GHCR) and switch
  `bootstrap.sh` from `docker compose build` to `docker compose pull`.
- **DNS zone management**: not automated — you create records yourself (or
  the tenant-provisioner does, per-tenant, via `CF_DNS_API_TOKEN`).

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars
# fill in terraform.tfvars, then:
terraform init
terraform plan
terraform apply
```

After `apply`, point DNS at `load_balancer_ip`, wait for cert issuance +
bootstrap to finish (watch `/var/log/saas-platform-bootstrap.log` over SSH),
then visit `https://saas.riogentix.com`.
