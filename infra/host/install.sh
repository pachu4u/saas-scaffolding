#!/usr/bin/env bash
# Host-level log hygiene for the STACKIT app VM. Run from the repo root:
#   infra/host/install.sh
# Installs Docker's default log limits (effective for containers created
# after the next dockerd restart, e.g. the next reboot) and a logrotate rule
# that caps existing containers' logs right away. Restarts nothing.
set -euo pipefail
cd "$(dirname "$0")/../.."
SSH=(ssh -i "${SSH_KEY:-$HOME/.ssh/saas_vm_access}" -o ConnectTimeout=15 "${VM_HOST:-ubuntu@213.17.22.54}")
"${SSH[@]}" 'sudo install -m 0644 /dev/stdin /etc/docker/daemon.json' <infra/host/docker-daemon.json
"${SSH[@]}" 'sudo install -m 0644 /dev/stdin /etc/logrotate.d/docker-containers' <infra/host/logrotate-docker-containers
"${SSH[@]}" 'sudo python3 -m json.tool /etc/docker/daemon.json >/dev/null && sudo logrotate -d /etc/logrotate.d/docker-containers 2>&1 | grep -ciE "error" | sed "s/^/logrotate errors: /"'
