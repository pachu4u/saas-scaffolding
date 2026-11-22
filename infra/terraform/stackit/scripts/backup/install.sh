#!/usr/bin/env bash
# Install / update the nightly backup on the app VM. Run from
# infra/terraform/stackit after `terraform apply`:
#
#   ./scripts/backup/install.sh            # uses terraform outputs for host + config
#   SSH_KEY=~/.ssh/other ./scripts/backup/install.sh
#
# Secrets go straight from `terraform output` to the VM over SSH stdin; they
# are never written to local disk or printed.
set -euo pipefail
cd "$(dirname "$0")/../.."

SSH_KEY="${SSH_KEY:-$HOME/.ssh/saas_vm_access}"
HOST="ubuntu@$(terraform output -raw app_vm_ssh_ip)"
SSH=(ssh -i "$SSH_KEY" -o ConnectTimeout=15 "$HOST")

echo "installing backup script on $HOST"
"${SSH[@]}" 'sudo install -m 0755 /dev/stdin /usr/local/sbin/saas-backup' <scripts/backup/saas-backup.sh

terraform output -raw rendered_backup_env |
  "${SSH[@]}" 'sudo install -m 0600 -o root -g root /dev/stdin /etc/saas-backup.env'

"${SSH[@]}" 'sudo tee /etc/systemd/system/saas-backup.service >/dev/null' <<'EOF'
[Unit]
Description=Off-VM backup of Keycloak DB, config and k3s state to STACKIT Object Storage
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/saas-backup
Nice=10
IOSchedulingClass=idle
EOF

"${SSH[@]}" 'sudo tee /etc/systemd/system/saas-backup.timer >/dev/null' <<'EOF'
[Unit]
Description=Nightly saas-backup

[Timer]
OnCalendar=*-*-* 02:00:00 UTC
RandomizedDelaySec=10m
Persistent=true

[Install]
WantedBy=timers.target
EOF

"${SSH[@]}" 'sudo systemctl daemon-reload && sudo systemctl enable --now saas-backup.timer && systemctl list-timers saas-backup.timer --no-pager'
echo "done. Run one now with: ssh ... 'sudo systemctl start saas-backup && journalctl -u saas-backup -n 30'"
