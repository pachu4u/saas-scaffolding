#!/usr/bin/env bash
set -euo pipefail

# STACKIT-managed Postgres Flex grants the app's DB user only login/createdb
# (verified via `stackit postgresflex user create --help` and directly via
# `SELECT rolcreaterole FROM pg_roles` -- both false, and there's no API path
# to a superuser credential either). packages/db/prisma/migrations/0001_init
# and 0002_rls_grants both do CREATE ROLE app/migrator/platform_admin, which
# 42501s ("permission denied to create role") on a fresh STACKIT database.
#
# This only matters for local dev/techhanker.com, which connect as the
# container's own `postgres` superuser (see infra/compose/docker-compose.yml)
# -- CREATE ROLE and SET LOCAL ROLE both just work there, so those two
# migration files are deliberately left untouched (editing them would change
# their checksums and break `prisma migrate deploy` on techhanker.com, which
# has them recorded as already-applied).
#
# Since 2026-08-21 the RLS design itself no longer needs those roles at
# runtime (see migration 20260821000000_rls_bypass_via_guc_not_role +
# packages/db/src/client.ts) -- they're a schema-setup-time-only relic now.
# So the fix here is narrow: apply 0001_init.no-roles.sql (this directory --
# same as 0001_init/migration.sql minus the CREATE ROLE block and the
# app/migrator/platform_admin-specific GRANTs, which are either impossible or
# unnecessary against a single-login-user managed database), mark 0001_init /
# 0002_rls_grants / 20260722082735_grant_platform_admin_schema_usage resolved
# without running their SQL (0002's non-role content is a no-op re-apply of
# what 0001 already did; the platform_admin schema-usage grant is moot with
# no platform_admin role), then hand off to a normal `prisma migrate deploy`
# for every other (role-free) migration, including the RLS-bypass one above.
#
# Idempotent: safe to re-run against an already-migrated database (each step
# checks state before acting).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PKG_DIR="$SCRIPT_DIR/../../../../packages/db"
PRISMA="$DB_PKG_DIR/node_modules/.bin/prisma"

cd "$DB_PKG_DIR"

APPLIED=$(psql "$DATABASE_URL" -tAc \
  "SELECT migration_name FROM _prisma_migrations WHERE migration_name = '0001_init' AND finished_at IS NOT NULL" \
  2>/dev/null || true)

if [[ -z "$APPLIED" ]]; then
  echo "→ 0001_init not yet applied -- running the no-CREATE-ROLE variant directly"
  # Clear any failed-attempt row (e.g. from a plain `prisma migrate deploy`
  # that already 42501'd) so migrate resolve below doesn't see stale state.
  psql "$DATABASE_URL" -c \
    "DELETE FROM _prisma_migrations WHERE migration_name = '0001_init' AND finished_at IS NULL" \
    2>/dev/null || true
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/0001_init.no-roles.sql"
  "$PRISMA" migrate resolve --applied 0001_init
  "$PRISMA" migrate resolve --applied 0002_rls_grants
  "$PRISMA" migrate resolve --applied 20260722082735_grant_platform_admin_schema_usage
else
  echo "→ 0001_init already applied, skipping the manual step"
fi

echo "→ Running prisma migrate deploy for every other migration"
"$PRISMA" migrate deploy
