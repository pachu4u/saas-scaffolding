-- Create application roles; passwords set via env at runtime for prod.
-- This init script runs when the Docker volume is first created.

CREATE ROLE app LOGIN PASSWORD 'app_secret';
CREATE ROLE migrator LOGIN PASSWORD 'migrator_secret';
CREATE ROLE platform_admin NOLOGIN;

-- The migrator can impersonate platform_admin (needed for BYPASSRLS ops in migrations)
GRANT platform_admin TO migrator;

GRANT CONNECT ON DATABASE saas_platform TO app, migrator;
