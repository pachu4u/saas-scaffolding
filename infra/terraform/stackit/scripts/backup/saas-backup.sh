#!/usr/bin/env bash
# Nightly off-VM backup of the app VM's local state. Installed to
# /usr/local/sbin/saas-backup and run by saas-backup.timer (see install.sh).
#
# Archive contents (all inside one AES-256 encrypted tar.gz):
#   keycloak.dump      pg_dump -Fc of the Keycloak DB (keycloak-db container)
#   opt-saas.tar       /opt/saas-platform config: .env*, render/, bootstrap,
#                      deploy key, infra/ (compose files) -- not the git checkout
#   k3s-state.db       online sqlite backup of the k3s datastore
#   k3s-server.tar     k3s server TLS/CA material, token, cred
#   caddy-data.tar     Caddy ACME account + issued certs
#   SHA256SUMS         checksums of the above
#
# Config comes from /etc/saas-backup.env (root 0600), rendered by Terraform.
set -euo pipefail
umask 077

set -a
# shellcheck disable=SC1091
source /etc/saas-backup.env
set +a
: "${S3_ENDPOINT:?}" "${S3_REGION:?}" "${S3_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" \
  "${AWS_SECRET_ACCESS_KEY:?}" "${BACKUP_PASSPHRASE:?}" "${RETENTION_DAYS:?}"

AWS_CLI_IMAGE="amazon/aws-cli:2.17.0"
HOST="$(hostname -s)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d /var/tmp/saas-backup.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/stage"
mkdir -p "$STAGE"

log() { echo "[saas-backup] $*"; }

aws_cli() {
  docker run --rm -i \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION="$S3_REGION" \
    -v "$WORK:/work" \
    "$AWS_CLI_IMAGE" --endpoint-url "$S3_ENDPOINT" "$@"
}

log "dumping keycloak db"
docker exec keycloak-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$STAGE/keycloak.dump"
# A custom-format dump always lists its TOC; an empty or broken dump fails here.
docker exec -i keycloak-db pg_restore -l <"$STAGE/keycloak.dump" >/dev/null

log "archiving /opt/saas-platform config"
# Everything except the (re-clonable) git checkout, plus the checkout's .env
# files and infra/ dir, which hold local, uncommitted prod config.
tar -C /opt/saas-platform -cf "$STAGE/opt-saas.tar" --exclude='./repo' .
mapfile -t REPO_FILES < <(cd /opt/saas-platform/repo && ls -d .env .env.bak-* infra 2>/dev/null)
tar -C /opt/saas-platform/repo -rf "$STAGE/opt-saas.tar" --transform 's,^,repo/,' "${REPO_FILES[@]}"

if [ -f /var/lib/rancher/k3s/server/db/state.db ]; then
  log "backing up k3s datastore"
  python3 - "$STAGE/k3s-state.db" <<'PY'
import sqlite3, sys
src = sqlite3.connect("file:/var/lib/rancher/k3s/server/db/state.db?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[1])
src.backup(dst)
assert dst.execute("pragma integrity_check").fetchone()[0] == "ok"
dst.close(); src.close()
PY
  mapfile -t K3S_FILES < <(cd /var/lib/rancher/k3s/server && ls -d tls token cred 2>/dev/null)
  tar -C /var/lib/rancher/k3s/server -cf "$STAGE/k3s-server.tar" "${K3S_FILES[@]}"
fi

CADDY_VOL="$(docker volume inspect saas-platform_caddy-data --format '{{.Mountpoint}}' 2>/dev/null || true)"
if [ -n "$CADDY_VOL" ]; then
  log "archiving caddy data"
  tar -C "$CADDY_VOL" -cf "$STAGE/caddy-data.tar" .
fi

(cd "$STAGE" && sha256sum ./* >SHA256SUMS)

NAME="${HOST}/${TS}.tar.gz.enc"
log "encrypting"
tar -C "$STAGE" -czf - . |
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
    -out "$WORK/archive.enc"

log "uploading s3://$S3_BUCKET/$NAME ($(du -h "$WORK/archive.enc" | cut -f1))"
aws_cli s3 cp "/work/archive.enc" "s3://$S3_BUCKET/$NAME" --only-show-errors
# Read it back to prove the upload is complete.
aws_cli s3api head-object --bucket "$S3_BUCKET" --key "$NAME" >/dev/null

log "pruning archives older than $RETENTION_DAYS days"
CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%S)"
OLD="$(aws_cli s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "${HOST}/" \
  --query "Contents[?LastModified<'${CUTOFF}'].Key" --output text || true)"
for key in $OLD; do
  [ "$key" = "None" ] && continue
  log "deleting $key"
  aws_cli s3 rm "s3://$S3_BUCKET/$key" --only-show-errors
done

# Heartbeat for monitoring: last successful run.
date -u +%s >/var/lib/saas-backup.last-success
if [ -d /var/lib/node-exporter ]; then
  printf '# HELP saas_backup_last_success_timestamp_seconds Unix time of the last successful off-VM backup.\n# TYPE saas_backup_last_success_timestamp_seconds gauge\nsaas_backup_last_success_timestamp_seconds %s\n' \
    "$(cat /var/lib/saas-backup.last-success)" >/var/lib/node-exporter/saas_backup.prom.tmp
  chmod 0644 /var/lib/node-exporter/saas_backup.prom.tmp
  mv /var/lib/node-exporter/saas_backup.prom.tmp /var/lib/node-exporter/saas_backup.prom
fi
log "done: $NAME"
