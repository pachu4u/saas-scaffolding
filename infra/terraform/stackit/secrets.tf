# Generated once at first apply and then held stable in state (Terraform
# only re-generates a random_password on an explicit taint/replace). All of
# these get written into the VM's .env / tenant-provisioner secret.env via
# templates -- see locals.tf and outputs.tf for the rendered_* escape hatch
# if you need to push a rotated value to an already-running VM.

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "random_password" "platform_internal_secret" {
  length  = 32
  special = false
}

resource "random_password" "keycloak_client_secret" {
  length  = 40
  special = false
}

resource "random_password" "keycloak_admin_password" {
  length  = 24
  special = false
}

resource "random_password" "oauth2_proxy_client_secret" {
  length  = 40
  special = false
}

# oauth2-proxy wants a base64-encoded 32-byte value specifically for
# --cookie-secret (AES-256 key for the encrypted session cookie), not an
# arbitrary string -- random_id's b64_std output is exactly that (32 random
# bytes, standard base64), unlike random_password's restricted charset.
resource "random_id" "oauth2_proxy_cookie_secret" {
  byte_length = 32
}

resource "random_password" "riogentix_saas_internal_secret" {
  length  = 32
  special = false
}

resource "random_password" "riogentix_internal_secret" {
  length  = 32
  special = false
}

resource "random_password" "app_db_password" {
  length  = 32
  special = false
}

resource "random_password" "migrator_db_password" {
  length  = 32
  special = false
}

resource "random_password" "keycloak_db_password" {
  length  = 32
  special = false
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
}
