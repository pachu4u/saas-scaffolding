#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

# 1. Ensure TLS certs exist
if [[ ! -f "infra/compose/traefik/certs/_wildcard.lvh.me.pem" ]]; then
  echo "→ TLS certs not found. Running mkcert-setup.sh..."
  bash scripts/mkcert-setup.sh
fi

# 2. Copy .env.example if .env missing
if [[ ! -f ".env" ]]; then
  echo "→ .env not found. Copying .env.example → .env"
  cp .env.example .env
  echo "  ⚠  Edit .env with real secrets before continuing."
fi

# Load .env into the current shell so Prisma and other tools can read it
# Use sed to strip \r (Windows CRLF) and skip comments/blank lines
while IFS= read -r line; do
  # Remove carriage returns, skip comments and blank lines
  line="${line//$'\r'/}"
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  export "$line" 2>/dev/null || true
done < .env

# 3. Ensure shared Docker network exists
docker network create platform 2>/dev/null || true

# 4. Bring up platform services
echo "→ Starting Docker Compose services..."
docker compose \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.observability.yml \
  -f infra/compose/docker-compose.tools.yml \
  up -d

# 4. Wait for app-db to be healthy
echo "→ Waiting for app-db..."
until docker compose -f infra/compose/docker-compose.yml exec app-db pg_isready -U postgres -d saas_platform &>/dev/null; do
  sleep 2
done

# 5. Run migrations + seed
echo "→ Running DB migrations..."
pnpm --filter @platform/db db:migrate

echo "→ Seeding database..."
pnpm --filter @platform/db db:seed

echo ""
echo "✓ Platform is up!"
echo "  App:      https://app.lvh.me"
echo "  Auth:     https://auth.lvh.me"
echo "  Grafana:  https://grafana.lvh.me"
echo "  Mail:     https://mail.lvh.me"
echo "  Traefik:  https://traefik.lvh.me"
echo ""
echo "→ Starting dev servers..."
pnpm dev
