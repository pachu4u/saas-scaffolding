-- AuditLog: don't let a hard tenant delete silently wipe the audit trail.
-- Application code only ever soft-deletes tenants (status: DELETED); RESTRICT
-- makes a hard delete fail loudly instead of cascading through compliance history.
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_tenant_id_fkey";
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ScimToken: hashed_token is looked up on every SCIM request (bearer auth) but had no index.
CREATE INDEX "scim_tokens_hashed_token_idx" ON "scim_tokens"("hashed_token");

-- ExternalIdentity: tenant_id had no FK relation at all, risking orphaned rows.
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
