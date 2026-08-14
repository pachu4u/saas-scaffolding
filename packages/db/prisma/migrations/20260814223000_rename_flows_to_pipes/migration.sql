-- Rename the "flows" resource-limit/usage-kind to "pipes" in existing data.
-- Schema is unchanged (resource_limits stays a JSONB blob, kind stays free
-- text) — this only rewrites the values so they match the app's renamed
-- field. Requires a matching rename on the Riogentix side (its own
-- SaasTenant.resource_limits JSON and services/usage_counter.py "flows"
-- kind) or these pushes/ingests will be rejected as unknown keys.

UPDATE "tenants"
SET "resource_limits" = ("resource_limits" - 'flows') || jsonb_build_object('pipes', "resource_limits"->'flows')
WHERE "resource_limits" ? 'flows';

UPDATE "usage_events"
SET "kind" = 'pipes'
WHERE "kind" = 'flows';

UPDATE "usage_snapshots"
SET "kind" = 'pipes'
WHERE "kind" = 'flows';
