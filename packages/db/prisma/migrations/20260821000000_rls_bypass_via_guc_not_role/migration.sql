-- Replaces the Postgres-role-based RLS bypass (SET LOCAL ROLE platform_admin,
-- granted BYPASSRLS in 0002_rls_grants) with a session-variable-based one
-- (set_config('app.bypass_rls', 'true', true)). The role-based design assumed
-- the app's DB user could either already own/create the app/migrator/
-- platform_admin roles, or connect as a Postgres superuser that can SET ROLE
-- to them -- true for local dev and techhanker.com (both connect as the
-- container's own `postgres` superuser), but not for STACKIT's managed
-- Postgres Flex, where the provisioned user is a plain login role with no
-- CREATEROLE and no path to acquire one via STACKIT's API (checked: the CLI's
-- `postgresflex user create/update --role` only accepts login/createdb).
--
-- This migration only touches policies, not roles/grants -- it doesn't
-- retouch 0001_init/0002_rls_grants/20260722082735_grant_platform_admin_schema_usage,
-- so their checksums (and behavior on already-migrated databases like
-- techhanker.com) are untouched. packages/db/src/client.ts is updated
-- alongside this to match: withPlatformAdmin now does
-- SET LOCAL "app.bypass_rls" = 'true' instead of SET LOCAL ROLE platform_admin.
-- withTenant drops its SET LOCAL ROLE app entirely -- the app role's only
-- purpose was scoping RLS to tenant_id, which set_config('app.tenant_id', ...)
-- alone already does; the extra role switch was redundant even before this.

DROP POLICY IF EXISTS tenant_isolation ON tenant_users;
CREATE POLICY tenant_isolation ON tenant_users
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON role_bindings;
CREATE POLICY tenant_isolation ON role_bindings
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON scim_tokens;
CREATE POLICY tenant_isolation ON scim_tokens
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON external_identities;
CREATE POLICY tenant_isolation ON external_identities
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON audit_log;
CREATE POLICY tenant_isolation ON audit_log
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON idempotency_keys;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON webhook_endpoints;
CREATE POLICY tenant_isolation ON webhook_endpoints
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON webhook_deliveries;
CREATE POLICY tenant_isolation ON webhook_deliveries
  USING (current_setting('app.bypass_rls', true) = 'true' OR endpoint_id IN (
    SELECT id FROM webhook_endpoints
    WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

DROP POLICY IF EXISTS tenant_isolation ON notes;
CREATE POLICY tenant_isolation ON notes
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
CREATE POLICY tenant_isolation ON subscriptions
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON usage_events;
CREATE POLICY tenant_isolation ON usage_events
  USING (current_setting('app.bypass_rls', true) = 'true' OR tenant_id = current_setting('app.tenant_id', true)::uuid);
