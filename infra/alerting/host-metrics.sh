#!/usr/bin/env bash
# Writes host facts node-exporter can't see by itself to its textfile dir.
set -euo pipefail
OUT=/var/lib/node-exporter/host.prom
reboot=0; [ -f /var/run/reboot-required ] && reboot=1
updates=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst ' || true)
security=$(apt-get -s upgrade 2>/dev/null | grep '^Inst ' | grep -ci security || true)
cat >"$OUT.tmp" <<EOF
# HELP node_reboot_required 1 if /var/run/reboot-required exists.
# TYPE node_reboot_required gauge
node_reboot_required $reboot
# HELP node_apt_upgrades_pending Packages with pending upgrades.
# TYPE node_apt_upgrades_pending gauge
node_apt_upgrades_pending $updates
# HELP node_apt_security_upgrades_pending Pending upgrades from a security pocket.
# TYPE node_apt_security_upgrades_pending gauge
node_apt_security_upgrades_pending $security
EOF
chmod 0644 "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
