-- 0001_init modelled these status columns as TEXT + CHECK constraints, but
-- schema.prisma declares them as Prisma enums. For the postgresql provider,
-- Prisma enums always compile to native CREATE TYPE ... AS ENUM and the
-- generated client casts values to that type name — which never existed,
-- so every query touching these columns failed with "type ... does not exist".
-- This converts each column to the native enum type schema.prisma expects,
-- matching the pattern 0003_provisioning already used correctly.

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "TenantUserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD');
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'DEAD');

ALTER TABLE tenants
  DROP CONSTRAINT tenants_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "TenantStatus" USING status::"TenantStatus",
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE users
  DROP CONSTRAINT users_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "UserStatus" USING status::"UserStatus",
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE tenant_users
  DROP CONSTRAINT tenant_users_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "TenantUserStatus" USING status::"TenantUserStatus",
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE subscriptions
  DROP CONSTRAINT subscriptions_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "SubscriptionStatus" USING status::"SubscriptionStatus",
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE jobs
  DROP CONSTRAINT jobs_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "JobStatus" USING status::"JobStatus",
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE webhook_endpoints
  DROP CONSTRAINT webhook_endpoints_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "WebhookEndpointStatus" USING status::"WebhookEndpointStatus",
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE webhook_deliveries
  DROP CONSTRAINT webhook_deliveries_status_check,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "WebhookDeliveryStatus" USING status::"WebhookDeliveryStatus",
  ALTER COLUMN status SET DEFAULT 'PENDING';
