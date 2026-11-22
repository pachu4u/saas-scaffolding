#!/usr/bin/env bash
# Install / update alerting on the STACKIT app VM. Run from the repo root:
#
#   ALERT_EMAIL=you@example.com infra/alerting/install.sh
#
# Copies the Prometheus config/rules + alerting compose files to the VM
# (whose git checkout is stale, so files are pushed individually), renders
# Alertmanager's config from the app's SMTP settings in the VM's .env (the
# SMTP password never leaves the VM), recreates Prometheus only, and starts
# node-exporter, blackbox-exporter and alertmanager.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${ALERT_EMAIL:?set ALERT_EMAIL}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/saas_vm_access}"
HOST="${VM_HOST:-ubuntu@213.17.22.54}"
SSH=(ssh -i "$SSH_KEY" -o ConnectTimeout=15 "$HOST")
R=/opt/saas-platform/repo/infra

push() { "${SSH[@]}" "sudo mkdir -p \"$(dirname "$2")\" && sudo tee \"$2\" >/dev/null" <"$1"; }

push infra/observability/prometheus.yml "$R/observability/prometheus.yml"
push infra/observability/rules/platform.yml "$R/observability/rules/platform.yml"
push infra/compose/docker-compose.observability.yml "$R/compose/docker-compose.observability.yml"
push infra/alerting/docker-compose.alerting.yml "$R/alerting/docker-compose.alerting.yml"
push infra/alerting/blackbox.yml "$R/alerting/blackbox.yml"
push infra/alerting/host-metrics.sh /usr/local/sbin/saas-host-metrics

"${SSH[@]}" sudo ALERT_EMAIL="$ALERT_EMAIL" bash -s <<'REMOTE'
set -euo pipefail
R=/opt/saas-platform/repo/infra
chmod 0755 /usr/local/sbin/saas-host-metrics
mkdir -p /var/lib/node-exporter /etc/saas-alerting

getenv() { grep -E "^$1=" /opt/saas-platform/repo/.env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
SMTP_HOST=$(getenv SMTP_HOST); SMTP_PORT=$(getenv SMTP_PORT)
SMTP_USERNAME=$(getenv SMTP_USERNAME); EMAIL_FROM=$(getenv EMAIL_FROM)

umask 077
getenv SMTP_PASSWORD | tr -d '\n' >/etc/saas-alerting/smtp_password
cat >/etc/saas-alerting/alertmanager.yml <<EOF
global:
  smtp_smarthost: '${SMTP_HOST}:${SMTP_PORT}'
  smtp_from: 'riogentix alerts <${EMAIL_FROM}>'
  smtp_auth_username: '${SMTP_USERNAME}'
  smtp_auth_password_file: /etc/alertmanager/smtp_password
  # Port 465 is implicit TLS (the whole session is encrypted), so STARTTLS
  # must not be required on top; on 587 STARTTLS would be required.
  smtp_require_tls: $( [ "$SMTP_PORT" = 465 ] && echo false || echo true )

route:
  receiver: email
  group_by: [alertname, instance]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 6h

inhibit_rules:
  # If the public probe fails because the app itself is down, one email is enough.
  - source_matchers: [job="blackbox-internal"]
    target_matchers: [job="blackbox-http"]
    equal: [alertname]

receivers:
  - name: email
    email_configs:
      - to: '${ALERT_EMAIL}'
        send_resolved: true
EOF
# alertmanager runs as nobody (65534)
chown -R 65534:65534 /etc/saas-alerting
chmod 0500 /etc/saas-alerting; chmod 0400 /etc/saas-alerting/*

cat >/etc/systemd/system/saas-host-metrics.service <<'EOF'
[Unit]
Description=Write host textfile metrics (reboot-required, pending updates) for node-exporter
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/saas-host-metrics
EOF
cat >/etc/systemd/system/saas-host-metrics.timer <<'EOF'
[Unit]
Description=Refresh host textfile metrics
[Timer]
OnBootSec=2m
OnUnitActiveSec=15m
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now saas-host-metrics.timer >/dev/null
/usr/local/sbin/saas-host-metrics
# Seed the backup heartbeat from the last successful run, if any.
if [ -f /var/lib/saas-backup.last-success ]; then
  printf '# TYPE saas_backup_last_success_timestamp_seconds gauge\nsaas_backup_last_success_timestamp_seconds %s\n' \
    "$(cat /var/lib/saas-backup.last-success)" >/var/lib/node-exporter/saas_backup.prom
  chmod 0644 /var/lib/node-exporter/saas_backup.prom
fi

cd "$R/alerting"
docker compose -p saas-alerting -f docker-compose.alerting.yml up -d

# Recreate only Prometheus so it picks up the rules mount and lifecycle flag.
cd "$R/compose"
docker compose -f docker-compose.yml -f docker-compose.observability.yml \
  -f docker-compose.tools.yml -f docker-compose.stackit.yml up -d --no-deps --force-recreate prometheus
REMOTE
echo "alerting installed; alerts go to $ALERT_EMAIL"
