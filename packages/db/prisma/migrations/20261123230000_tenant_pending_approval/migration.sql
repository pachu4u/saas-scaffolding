-- Self-service signups wait for platform-admin approval before provisioning.
ALTER TYPE "TenantStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
