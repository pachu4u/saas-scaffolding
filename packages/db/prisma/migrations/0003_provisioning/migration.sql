-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('DEV', 'TEST', 'PROD');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "provisioning_status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "tenants" ADD COLUMN "provisioning_error" TEXT;

-- CreateTable
CREATE TABLE "tenant_environments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'PENDING',
    "endpoint" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_environments_tenant_id_type_key" ON "tenant_environments"("tenant_id", "type");

-- AddForeignKey
ALTER TABLE "tenant_environments" ADD CONSTRAINT "tenant_environments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
