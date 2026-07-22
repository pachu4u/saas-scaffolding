-- 0002_rls_grants granted platform_admin table/sequence privileges but never
-- granted USAGE on the public schema itself, so every SET LOCAL ROLE platform_admin
-- transaction (withPlatformAdmin, used by signup/tenant creation) failed with
-- "permission denied for schema public" despite having table-level grants.
GRANT USAGE ON SCHEMA public TO platform_admin;
