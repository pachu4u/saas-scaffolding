# Off-VM backups for state that lives only on the app VM.
#
# STACKIT Postgres Flex (control-plane + tenant DBs) has its own managed
# backups. What it does NOT cover, and what used to have no backup at all:
#   - the Keycloak database (keycloak-db container, volume saas-platform_keycloak-db-data)
#   - /opt/saas-platform config incl. the rendered .env and deploy key
#   - the k3s datastore (sqlite) + its CA/TLS material and join token
#   - Caddy's ACME account + issued certificates
#
# scripts/backup/saas-backup.sh dumps those nightly, encrypts the archive with
# backup_encryption_passphrase (AES-256, PBKDF2) and uploads it to the bucket
# below, pruning objects older than var.backup_retention_days. It is installed
# on the VM by scripts/backup/install.sh (user_data is ignore_changes'd, so it
# can't be pushed via cloud-init).
#
# The passphrase lives in this (local) Terraform state and on the VM. Without
# it the archives can't be decrypted -- `terraform output -raw
# backup_encryption_passphrase` is the off-VM copy, so keep the state safe.

resource "stackit_objectstorage_bucket" "backups" {
  project_id = var.project_id
  name       = "${var.name_prefix}-backups"
}

resource "stackit_objectstorage_credentials_group" "backups" {
  project_id = var.project_id
  name       = "${var.name_prefix}-backups"
}

resource "stackit_objectstorage_credential" "backups" {
  project_id           = var.project_id
  credentials_group_id = stackit_objectstorage_credentials_group.backups.credentials_group_id
}

resource "random_password" "backup_encryption_passphrase" {
  length  = 48
  special = false
}

# Whole-VM safety net: STACKIT server backups (block-level, kept in STACKIT's
# backup service, outside the VM). Off by default because it is billed per GB
# of backup storage -- enable with enable_vm_backups = true.
resource "stackit_server_backup_schedule" "app" {
  count = var.enable_vm_backups ? 1 : 0

  project_id = var.project_id
  server_id  = stackit_server.app.server_id
  name       = "${var.name_prefix}-app-daily"
  enabled    = true
  # Daily at 02:30 UTC, after the 02:00 logical backup has finished.
  rrule = "DTSTART;TZID=Etc/UTC:20261123T023000 RRULE:FREQ=DAILY;INTERVAL=1"

  backup_properties = {
    name             = "${var.name_prefix}-app-auto"
    retention_period = var.vm_backup_retention_days
  }
}

output "backup_bucket" {
  value = stackit_objectstorage_bucket.backups.name
}

# Rendered /etc/saas-backup.env for the VM. Consumed by
# scripts/backup/install.sh via stdin; never print it.
output "rendered_backup_env" {
  sensitive = true
  value     = <<-EOT
    S3_ENDPOINT=https://object.storage.${var.stackit_region}.onstackit.cloud
    S3_REGION=${var.stackit_region}
    S3_BUCKET=${stackit_objectstorage_bucket.backups.name}
    AWS_ACCESS_KEY_ID=${stackit_objectstorage_credential.backups.access_key}
    AWS_SECRET_ACCESS_KEY=${stackit_objectstorage_credential.backups.secret_access_key}
    BACKUP_PASSPHRASE=${random_password.backup_encryption_passphrase.result}
    RETENTION_DAYS=${var.backup_retention_days}
  EOT
}

output "backup_encryption_passphrase" {
  sensitive = true
  value     = random_password.backup_encryption_passphrase.result
}
