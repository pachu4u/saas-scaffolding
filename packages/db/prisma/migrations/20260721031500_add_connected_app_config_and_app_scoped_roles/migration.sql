-- DropIndex
ALTER TABLE "roles" DROP CONSTRAINT "roles_tenant_id_name_key";

-- AlterTable
ALTER TABLE "connected_apps" ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "docs_url" TEXT,
ADD COLUMN     "icon_url" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "app_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_app_id_name_key" ON "roles"("tenant_id", "app_id", "name");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "connected_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
