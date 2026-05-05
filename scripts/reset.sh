#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

echo "⚠  This will destroy ALL Docker volumes (databases, Redis, etc.)."
read -r -p "Type 'yes' to confirm: " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Tearing down all services and volumes..."
docker compose \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.observability.yml \
  -f infra/compose/docker-compose.tools.yml \
  down -v --remove-orphans

echo "→ Removing Turbo cache..."
pnpm turbo daemon stop 2>/dev/null || true
rm -rf .turbo

echo "✓ Reset complete. Run ./scripts/dev.sh to start fresh."
