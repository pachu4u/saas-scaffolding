provider "stackit" {
  default_region = var.stackit_region

  # service_account_key_path holds the JSON key downloaded from the STACKIT
  # Portal for the service account Terraform authenticates as (see README
  # "Required access" section). Prefer STACKIT_SERVICE_ACCOUNT_KEY_PATH env
  # var instead of committing the value here.
  service_account_key_path = var.stackit_service_account_key_path

  # image_v2 and machine_type data sources (used in data.tf) are still beta.
  enable_beta_resources = true
}
