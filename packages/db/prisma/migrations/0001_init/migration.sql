-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ─── Roles ───────────────────────────────────────────────────────────────────
-- Create app role (least privilege) and migrator role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN PASSWORD 'app_secret';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migrator') THEN
    CREATE ROLE migrator LOGIN PASSWORD 'migrator_secret';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'platform_admin') THEN
    CREATE ROLE platform_admin;
  END IF;
END$$;

-- Grant privileges
GRANT CONNECT ON DATABASE saas_platform TO app, migrator;
GRANT USAGE ON SCHEMA public TO app;
GRANT ALL ON SCHEMA public TO migrator;

-- ─── Tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            CITEXT      NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  plan            TEXT        NOT NULL DEFAULT 'free',
  custom_domains  TEXT[]      NOT NULL DEFAULT '{}',
  branding        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT        NOT NULL UNIQUE,
  email       CITEXT      NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tenant Users ─────────────────────────────────────────────────────────────
CREATE TABLE tenant_users (
  tenant_id UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status    TEXT        NOT NULL DEFAULT 'ACTIVE'
              CHECK (status IN ('ACTIVE','INVITED','SUSPENDED')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

-- ─── Authorization ───────────────────────────────────────────────────────────
CREATE TABLE roles (
  id        UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID    REFERENCES tenants(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
  id   UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE role_bindings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id   UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, user_id, role_id)
);

-- ─── Billing ─────────────────────────────────────────────────────────────────
CREATE TABLE plans (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  features        JSONB NOT NULL DEFAULT '{}',
  price_id_stripe TEXT
);

CREATE TABLE subscriptions (
  tenant_id              UUID        NOT NULL PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                UUID        NOT NULL REFERENCES plans(id),
  status                 TEXT        NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('TRIALING','ACTIVE','PAST_DUE','CANCELED','PAUSED')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ,
  trial_ends_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usage_events (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL,
  quantity    INT         NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usage_events_tenant_kind ON usage_events (tenant_id, kind, occurred_at);

-- ─── SCIM ────────────────────────────────────────────────────────────────────
CREATE TABLE scim_tokens (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  hashed_token TEXT        NOT NULL,
  scopes       TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE external_identities (
  id          UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID  NOT NULL,
  user_id     UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idp         TEXT  NOT NULL,
  idp_user_id TEXT  NOT NULL,
  raw         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, idp, idp_user_id)
);

-- ─── Audit ───────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id            BIGSERIAL   NOT NULL PRIMARY KEY,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   TEXT        NOT NULL,
  before        JSONB,
  after         JSONB,
  ip            TEXT,
  user_agent    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id);

-- ─── Async ───────────────────────────────────────────────────────────────────
CREATE TABLE jobs (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  queue        TEXT        NOT NULL,
  payload      JSONB       NOT NULL DEFAULT '{}',
  status       TEXT        NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','DEAD')),
  attempts     INT         NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jobs_queue_status ON jobs (queue, status, scheduled_for);

CREATE TABLE idempotency_keys (
  key          TEXT        NOT NULL PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_hash TEXT        NOT NULL,
  response     JSONB,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);

-- ─── Webhooks ────────────────────────────────────────────────────────────────
CREATE TABLE webhook_endpoints (
  id        UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url       TEXT  NOT NULL,
  secret    TEXT  NOT NULL,
  events    TEXT[] NOT NULL DEFAULT '{}',
  status    TEXT  NOT NULL DEFAULT 'ACTIVE'
              CHECK (status IN ('ACTIVE','PAUSED','DELETED'))
);

CREATE TABLE webhook_deliveries (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id  UUID        NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id     TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','SUCCESS','FAILED','DEAD')),
  attempts     INT         NOT NULL DEFAULT 0,
  last_error   TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries (endpoint_id, status);

-- ─── Demo table ──────────────────────────────────────────────────────────────
CREATE TABLE notes (
  id        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  body      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notes_tenant ON notes (tenant_id);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
ALTER TABLE tenant_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_bindings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events       ENABLE ROW LEVEL SECURITY;

-- RLS policy macro: tenant-scoped tables with tenant_id column
CREATE POLICY tenant_isolation ON tenant_users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON role_bindings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON scim_tokens
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON external_identities
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON jobs
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON webhook_endpoints
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON webhook_deliveries
  USING (endpoint_id IN (
    SELECT id FROM webhook_endpoints
    WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

CREATE POLICY tenant_isolation ON notes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON usage_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- platform_admin role bypasses RLS
ALTER TABLE tenant_users       FORCE ROW LEVEL SECURITY;
ALTER TABLE role_bindings      FORCE ROW LEVEL SECURITY;
ALTER TABLE scim_tokens        FORCE ROW LEVEL SECURITY;
ALTER TABLE external_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log          FORCE ROW LEVEL SECURITY;
ALTER TABLE jobs               FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys   FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints  FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE notes              FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_events       FORCE ROW LEVEL SECURITY;

-- Grant DML to app role (no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO migrator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migrator;

-- platform_admin can bypass RLS
GRANT platform_admin TO migrator;
ALTER ROLE platform_admin BYPASSRLS;
