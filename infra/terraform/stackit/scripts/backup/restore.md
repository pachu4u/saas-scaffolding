# Restoring from saas-backup archives

Nightly archives live in the `saas-platform-backups` bucket under
`<vm-hostname>/<UTC timestamp>.tar.gz.enc` (see `backup.tf`,
`saas-backup.sh`). They are AES-256 encrypted; the passphrase is in the local
Terraform state (`terraform output -raw backup_encryption_passphrase`) and in
`/etc/saas-backup.env` on the VM.

## 1. Fetch and decrypt (on the VM, or any host with docker + openssl)

```bash
sudo -i
set -a; source /etc/saas-backup.env; set +a   # or export the vars by hand on a new host
mkdir -p /var/tmp/restore && cd /var/tmp/restore
aws() { docker run --rm -i -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION="$S3_REGION" \
  -v "$PWD:/work" -w /work amazon/aws-cli:2.17.0 --endpoint-url "$S3_ENDPOINT" "$@"; }
aws s3 ls "s3://$S3_BUCKET/" --recursive | tail        # pick the newest key
aws s3 cp "s3://$S3_BUCKET/<key>" archive.enc
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in archive.enc | tar -xzf -
sha256sum -c SHA256SUMS
```

## 2. Keycloak DB

Restoring replaces Keycloak's users, realms and sessions. Stop Keycloak first.

```bash
docker stop keycloak
docker exec -i keycloak-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < keycloak.dump
docker start keycloak
```

To check a dump without touching prod, restore it into a throwaway container:

```bash
docker run -d --name kc-restore-test -e POSTGRES_PASSWORD=x postgres:16-alpine
sleep 5
docker exec -i kc-restore-test pg_restore -U postgres -d postgres --no-owner < keycloak.dump
docker exec kc-restore-test psql -U postgres -Atc "select name from realm; select count(*) from user_entity;"
docker rm -f kc-restore-test
```

## 3. Config (/opt/saas-platform)

`tar -xf opt-saas.tar -C /opt/saas-platform` restores `.env`, `render/`, the
deploy key and `repo/infra`. On a fresh VM, clone the repo to
`/opt/saas-platform/repo` first, then extract.

## 4. k3s

With k3s stopped: copy `k3s-state.db` to
`/var/lib/rancher/k3s/server/db/state.db` (delete any `-wal`/`-shm` files) and
extract `k3s-server.tar` into `/var/lib/rancher/k3s/server`, then start k3s.

## 5. Caddy

`tar -xf caddy-data.tar -C $(docker volume inspect saas-platform_caddy-data --format '{{.Mountpoint}}')`
then `docker restart caddy`.

## Whole-VM restore

If `enable_vm_backups = true`, STACKIT server backups exist too:
`stackit server backup list --server-id <id>` and
`stackit server backup restore <backup-id> --server-id <id>` (this stops the VM).
