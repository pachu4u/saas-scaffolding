# Remote home for this stack's Terraform state (see versions.tf backend
# block and README "Remote state"). Created while state was still local,
# then `terraform init -migrate-state` moved it here. The state holds every
# generated secret, so the bucket gets its own credentials group and the
# credentials live only in the gitignored backend.hcl on the operator's
# machine (and in this state, which is unavoidable).
resource "stackit_objectstorage_bucket" "tfstate" {
  project_id = var.project_id
  name       = "${var.name_prefix}-tfstate"
}

resource "stackit_objectstorage_credentials_group" "tfstate" {
  project_id = var.project_id
  name       = "${var.name_prefix}-tfstate"
}

resource "stackit_objectstorage_credential" "tfstate" {
  project_id           = var.project_id
  credentials_group_id = stackit_objectstorage_credentials_group.tfstate.credentials_group_id
}

# `terraform output -raw rendered_backend_hcl > backend.hcl` (gitignored).
output "rendered_backend_hcl" {
  sensitive = true
  value     = <<-EOT
    access_key = "${stackit_objectstorage_credential.tfstate.access_key}"
    secret_key = "${stackit_objectstorage_credential.tfstate.secret_access_key}"
  EOT
}
