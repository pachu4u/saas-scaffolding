-- CreateTable
CREATE TABLE "riogentix_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "saas_user_id" UUID NOT NULL,
    "riogentix_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riogentix_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "riogentix_users_tenant_id_saas_user_id_key" ON "riogentix_users"("tenant_id", "saas_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "riogentix_users_tenant_id_riogentix_user_id_key" ON "riogentix_users"("tenant_id", "riogentix_user_id");

-- AddForeignKey
ALTER TABLE "riogentix_users" ADD CONSTRAINT "riogentix_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riogentix_users" ADD CONSTRAINT "riogentix_users_saas_user_id_fkey" FOREIGN KEY ("saas_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
