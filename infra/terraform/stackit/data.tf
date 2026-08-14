# Both data sources are still beta in the provider (enable_beta_resources = true
# in provider.tf). Pin to a static image_id instead once you've picked one, to
# avoid the app VM being recreated whenever a new Ubuntu point release is published.

data "stackit_image_v2" "app_os" {
  project_id     = var.project_id
  name_regex     = var.vm_image_name_regex
  sort_ascending = false # newest matching point release first

  # Without this, name_regex can match the arm64 build (distro "ubuntu-arm64")
  # depending on sort order, which 400s against any x86_64 machine type.
  filter = {
    distro = "ubuntu"
  }
}

data "stackit_machine_type" "app_vm" {
  project_id = var.project_id
  filter     = "vcpus >= ${var.vm_min_vcpus} && ram >= ${var.vm_min_ram_mb}"
}
