# STACKIT production runbooks (saas.riogentix.com)

Everything here runs from the operator's Mac unless noted. Terraform lives in
`infra/terraform/stackit` (remote state, see its README). The app VM is
`saas-platform-app` (SSH: `ssh -i ~/.ssh/saas_vm_access ubuntu@213.17.22.54`;
your public IP must be in `ssh_allowed_cidrs` in `terraform.tfvars`, applied
with `terraform apply`). Never print secrets; copy them with `| pbcopy`.

Compose commands on the VM always use all four files:

```bash
cd /opt/saas-platform/repo/infra/compose
F="-f docker-compose.yml -f docker-compose.observability.yml -f docker-compose.tools.yml -f docker-compose.stackit.yml"
```

## 1. Where the state lives

| What | Where | Backup |
|---|---|---|
| Platform + tenant databases | STACKIT Postgres Flex `saas-platform-app-db` | STACKIT daily backups (03:00 UTC) |
| Keycloak users/realms | `keycloak-db` container on the VM | nightly `saas-backup` archive |
| VM config (`.env`, rendered files, deploy key) | `/opt/saas-platform` | nightly `saas-backup` archive |
| k3s state (tenant namespaces, secrets) | `/var/lib/rancher/k3s/server` | nightly `saas-backup` archive |
| TLS certs | Caddy volume | nightly `saas-backup` archive (re-issuable anyway) |
| Terraform state | bucket `saas-platform-tfstate` (versioned) | bucket version history |

Nightly archives: bucket `saas-platform-backups`, prefix `saas-platform-app/`,
30 days. Restore details: `infra/terraform/stackit/scripts/backup/restore.md`.
Alert `BackupMissing` fires if no successful run for 26 h.

## 2. Restore Keycloak

1. Fetch and decrypt the newest archive (restore.md step 1).
2. Test it first in a throwaway container (restore.md step 2, second block).
3. Restore into the live DB (sign-in is down for ~1 minute):

   ```bash
   docker stop keycloak
   docker exec -i keycloak-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < keycloak.dump
   docker start keycloak
   ```

4. Check `https://auth.riogentix.com/realms/saas-platform/.well-known/openid-configuration`
   returns 200 and you can sign in at saas.riogentix.com.

Admin console: `ssh -L 8081:127.0.0.1:8081 ...` then http://localhost:8081/admin/
(public `/admin` is blocked). Password:
`ssh ... 'sudo docker exec keycloak printenv KEYCLOAK_ADMIN_PASSWORD' | tr -d '\n' | pbcopy`.

## 3. Restore a Postgres Flex database

Postgres Flex restores into a **new instance** (clone at a point in time):

```bash
stackit postgresflex backup list --instance-id c8a157b4-9a6e-4ef5-8d8d-4765a9b53a52
stackit postgresflex instance clone c8a157b4-9a6e-4ef5-8d8d-4765a9b53a52 --recovery-timestamp <RFC3339>
```

Then either point the apps at the clone (update `DATABASE_URL` in the VM
`.env`, the `saas-workers-env` secret and each tenant's `riogentix-env`
secret, recreate web/workers) or `pg_dump` the needed database from the clone
and `pg_restore` it into the live instance. A single tenant DB can be restored
the same way as the migration in section 6 (restore as the tenant login with
`--no-owner`).

## 4. Rebuild the VM

The VM is disposable if its backups are good:

1. `terraform apply -replace=stackit_server.app` (new VM, cloud-init bootstraps
   compose + k3s from `git_ref`). ~15 minutes of full downtime.
2. Copy the newest archive's `opt-saas.tar` back over `/opt/saas-platform`
   (it carries the current `.env`; Terraform's rendered copy may be older),
   restore Keycloak (section 2), and restore k3s (`k3s-state.db`,
   `k3s-server.tar`, restore.md step 4) so tenant namespaces and secrets come back.
3. Re-run `infra/terraform/stackit/scripts/backup/install.sh`,
   `ALERT_EMAIL=... infra/alerting/install.sh` and `infra/host/install.sh`.
4. Check section 7.

## 5. A tenant is stuck or down

```bash
kubectl -n t-<slug> get pods,events
kubectl -n t-<slug> logs deploy/riogentix --tail 100
kubectl -n ingress-nginx get pods        # after a reboot this can stick at 0/1
```

- Ingress controller 0/1 after a reboot: `kubectl -n ingress-nginx delete pod -l app.kubernetes.io/component=controller`.
- Pod crash-looping: check the DB login (`RIOGENTIX_DATABASE_URL` user should be
  `riogentix_<slug>`), quota (`kubectl -n t-<slug> describe resourcequota`), and
  the NetworkPolicy `tenant-isolation` if it can't reach something it needs.
- Re-provision (idempotent): re-enqueue the tenant's provision job from the
  admin UI; the provisioner reuses the tenant's Secret and DB login.
- New tenants refused with "Platform at capacity": raise `TENANT_MAX_COUNT`
  in the VM `.env` and the `saas-workers-env` secret only after adding
  capacity (bigger VM / Postgres flavor; Flex 2.4 allows 100 connections).

## 6. Tenant database logins

Each tenant connects as its own Postgres Flex user `riogentix_<slug>`, which can
only open its own database. Users are created by the k3s provisioner through
the STACKIT API (service account `saas-provisioner`, role
`postgres-flex.user-admin`). Deprovisioning deletes the login but keeps the DB.

Rotate one tenant's password: `stackit postgresflex user reset-password <id>`,
put the new URL in the tenant's `riogentix-env` secret, `kubectl -n t-<slug>
rollout restart deploy/riogentix`.

## 7. Health check after any change or reboot

```bash
curl -s https://saas.riogentix.com/_ready                 # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' https://auth.riogentix.com/realms/saas-platform/.well-known/openid-configuration
curl -s -o /dev/null -w '%{http_code}\n' https://test-corporation-3.riogentix.com/health
ssh ... 'sudo docker ps --format "{{.Names}} {{.Status}}"; sudo kubectl get pods -A'
```

Prometheus alerts (email) cover endpoints, TLS expiry, disk, memory, load and
backups; UptimeRobot covers the VM being gone entirely.

## 8. Rotate a leaked secret

| Secret | How |
|---|---|
| `saas_platform` DB password | `stackit postgresflex user reset-password 16679`, replace it in `/opt/saas-platform/repo/.env`, `render/*`, `infra/compose/docker-compose.stackit.yml`, `infra/k8s/tenant-provisioner/secret.env` and the `saas-workers-env` secret; recreate web/workers and restart `saas-workers`; then fix the copy in Terraform state (it can't read passwords back) |
| Keycloak admin | change it in the admin console, then in `.env` (`KEYCLOAK_ADMIN_PASSWORD`) and recreate web/workers |
| STACKIT SA keys | `stackit service-account key create --email <sa>`; replace the key file(s) / k8s secret; delete the old key |
| Backup passphrase | don't, unless leaked: old archives need the old one. If you must, `terraform apply -replace=random_password.backup_encryption_passphrase` and rerun the backup install script |

## 9. Deploy

Push to `infra/stackit-domain-config` (CI builds `web`/`workers` `:latest` and
`:<sha>`), then on the VM: `docker compose $F pull web workers && docker
compose $F up -d --no-deps --force-recreate web workers`. The k3s provisioner
uses the same workers image: pull `workers:<sha>`, tag it
`saas-platform-workers:k8s-deploy-<short sha>`, `docker save | k3s ctr images
import -`, `kubectl -n saas-platform set image deploy/saas-workers ...`.
