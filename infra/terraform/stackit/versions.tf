terraform {
  required_version = ">= 1.6"

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
