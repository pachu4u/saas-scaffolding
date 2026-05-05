#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/infra/compose/traefik/certs"
mkdir -p "$CERT_DIR"

# Check mkcert is installed
if ! command -v mkcert &>/dev/null; then
  echo "ERROR: mkcert is not installed."
  echo "  macOS:   brew install mkcert"
  echo "  Linux:   https://github.com/FiloSottile/mkcert#linux"
  echo "  Windows: choco install mkcert  OR  scoop install mkcert"
  exit 1
fi

echo "Installing mkcert local CA..."
mkcert -install

echo "Generating wildcard cert for *.lvh.me..."
cd "$CERT_DIR"
mkcert "*.lvh.me" lvh.me

# Rename to stable filenames Traefik expects
mv "./_wildcard.lvh.me+1.pem"     "./_wildcard.lvh.me.pem"     2>/dev/null || true
mv "./_wildcard.lvh.me+1-key.pem" "./_wildcard.lvh.me-key.pem" 2>/dev/null || true

echo ""
echo "✓ Certs written to $CERT_DIR"
echo "  _wildcard.lvh.me.pem"
echo "  _wildcard.lvh.me-key.pem"
echo ""
echo "Next: docker compose -f infra/compose/docker-compose.yml up -d traefik"
