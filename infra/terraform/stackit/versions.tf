terraform {
  required_version = ">= 1.6"

  # State lives in STACKIT Object Storage (bucket from state-backend.tf),
  # versioned + SSE-encrypted. Credentials come from the gitignored
  # backend.hcl:  terraform init -backend-config=backend.hcl
  # STACKIT ignores S3 conditional writes, so there is NO state locking:
  # only one person/run may apply at a time.
  backend "s3" {
    bucket = "saas-platform-tfstate"
    key    = "saas-platform/stackit/terraform.tfstate"
    region = "eu01"
    endpoints = {
      s3 = "https://object.storage.eu01.onstackit.cloud"
    }
    use_path_style              = true
    encrypt                     = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }

  required_providers {
    stackit = {
      source  = "stackitcloud/stackit"
      version = "~> 0.99"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
