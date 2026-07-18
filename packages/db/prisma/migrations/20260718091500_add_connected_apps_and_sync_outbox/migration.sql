
-- CreateEnum
CREATE TYPE "ConnectedAppStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SyncResourceType" AS ENUM ('USER', 'GROUP', 'TENANT');

-- CreateEnum
CREATE TYPE "SyncOp" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "connected_apps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConnectedAppStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_app_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scim_base_url" TEXT NOT NULL,
    "scim_token" TEXT NOT NULL,
    "status" "ConnectedAppStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_synced_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_app_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_outbox_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "resource_type" "SyncResourceType" NOT NULL,
    "resource_id" TEXT,
    "op" "SyncOp" NOT NULL DEFAULT 'UPSERT',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "SyncOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "sync_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connected_apps_slug_key" ON "connected_apps"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "connected_app_instances_app_id_tenant_id_key" ON "connected_app_instances"("app_id", "tenant_id");

-- CreateIndex
CREATE INDEX "sync_outbox_events_status_id_idx" ON "sync_outbox_events"("status", "id");

-- CreateIndex
CREATE INDEX "sync_outbox_events_tenant_id_status_idx" ON "sync_outbox_events"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "connected_app_instances" ADD CONSTRAINT "connected_app_instances_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "connected_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_app_instances" ADD CONSTRAINT "connected_app_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_outbox_events" ADD CONSTRAINT "sync_outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

