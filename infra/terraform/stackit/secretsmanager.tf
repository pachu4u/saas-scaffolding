# Managed, Vault-compatible secrets store (STACKIT Secrets Manager) replacing
# the in-memory dev-mode Vault container. The API is Vault's: userpass login
# at https://prod.sm.<region>.stackit.cloud, KV v2 mounted at the instance id.
# Holds tenant webhook / SCIM / API-key secrets and platform Stripe + email
# config written by the app (packages/vault).
resource "stackit_secretsmanager_instance" "app" {
  project_id = var.project_id
  name       = "${var.name_prefix}-secrets"
  # Only the app VM's egress IP (web, workers and the k3s provisioner all
  # leave through it) and the operator IPs allowed to SSH.
  acls = concat(["${stackit_public_ip.app_ssh.ip}/32"], var.ssh_allowed_cidrs)
}

resource "stackit_secretsmanager_user" "app" {
  project_id    = var.project_id
  instance_id   = stackit_secretsmanager_instance.app.instance_id
  description   = "saas-platform app (web + workers)"
  write_enabled = true
}

locals {
  vault_addr = "https://prod.sm.${var.stackit_region}.stackit.cloud"
}

output "secretsmanager_instance_id" {
  value = stackit_secretsmanager_instance.app.instance_id
}

# VAULT_* lines for /opt/saas-platform/repo/.env and the saas-workers-env
# secret. Never print it.
output "rendered_vault_env" {
  sensitive = true
  value     = <<-EOT
    VAULT_ADDR=${local.vault_addr}
    VAULT_USERNAME=${stackit_secretsmanager_user.app.username}
    VAULT_PASSWORD=${stackit_secretsmanager_user.app.password}
    VAULT_MOUNT_PATH=${stackit_secretsmanager_instance.app.instance_id}
  EOT
}
