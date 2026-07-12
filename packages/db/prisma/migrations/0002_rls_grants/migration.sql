-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE role_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;

ALTER TABLE role_bindings FORCE ROW LEVEL SECURITY;

ALTER TABLE scim_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE external_identities FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_endpoints FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;

ALTER TABLE notes FORCE ROW LEVEL SECURITY;

ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;

-- RLS Policies: tenant-scoped isolation via session variable
DROP POLICY IF EXISTS tenant_isolation ON tenant_users;
CREATE POLICY tenant_isolation ON tenant_users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON role_bindings;
CREATE POLICY tenant_isolation ON role_bindings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON scim_tokens;
CREATE POLICY tenant_isolation ON scim_tokens
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON external_identities;
CREATE POLICY tenant_isolation ON external_identities
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON audit_log;
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON idempotency_keys;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON webhook_endpoints;
CREATE POLICY tenant_isolation ON webhook_endpoints
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON webhook_deliveries;
CREATE POLICY tenant_isolation ON webhook_deliveries
  USING (endpoint_id IN (
    SELECT id FROM webhook_endpoints
    WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

DROP POLICY IF EXISTS tenant_isolation ON notes;
CREATE POLICY tenant_isolation ON notes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON usage_events;
CREATE POLICY tenant_isolation ON usage_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── Roles & Grants ──────────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (
    SELECT
    FROM pg_catalog.pg_roles
    WHERE
        rolname = 'app'
) THEN
CREATE ROLE app LOGIN PASSWORD 'app_secret';

END IF;

IF NOT EXISTS (
    SELECT
    FROM pg_catalog.pg_roles
    WHERE
        rolname = 'migrator'
) THEN
CREATE ROLE migrator LOGIN PASSWORD 'migrator_secret';

END IF;

IF NOT EXISTS (
    SELECT
    FROM pg_catalog.pg_roles
    WHERE
        rolname = 'platform_admin'
) THEN
CREATE ROLE platform_admin;

END IF;

END $$;

GRANT CONNECT ON DATABASE saas_platform TO app,
migrator;

GRANT USAGE ON SCHEMA public TO app;

GRANT ALL ON SCHEMA public TO migrator;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON ALL TABLES IN SCHEMA public TO app;

GRANT USAGE,
SELECT ON ALL SEQUENCES IN SCHEMA public TO app;

GRANT ALL ON ALL TABLES IN SCHEMA public TO migrator;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migrator;

-- Auto-grant on future tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON TABLES TO app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE,
SELECT ON SEQUENCES TO app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO migrator;

-- platform_admin bypasses RLS entirely
GRANT platform_admin TO migrator;

ALTER ROLE platform_admin BYPASSRLS;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;

GRANT USAGE,
SELECT
    ON ALL SEQUENCES IN SCHEMA public TO platform_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON TABLES TO platform_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE,
SELECT ON SEQUENCES TO platform_admin;