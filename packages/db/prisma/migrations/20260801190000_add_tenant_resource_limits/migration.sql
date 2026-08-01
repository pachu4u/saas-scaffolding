-- Per-tenant quota overrides pushed to Riogentix (flows/storage_bytes/api_keys/seats),
-- mirrors the shape of Riogentix's own SaasTenant.resource_limits JSON column.
ALTER TABLE "tenants" ADD COLUMN "resource_limits" JSONB NOT NULL DEFAULT '{}';
