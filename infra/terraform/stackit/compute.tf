resource "stackit_network_interface" "app" {
  project_id         = var.project_id
  network_id         = stackit_network.main.network_id
  security_group_ids = [stackit_security_group.app.security_group_id]
}

# Created without network_interface_id so the load balancer service can
# manage the association itself (see loadbalancer.tf) -- matches the
# provider's documented pattern for fronting a server with stackit_loadbalancer.
resource "stackit_public_ip" "lb" {
  project_id = var.project_id

  lifecycle {
    ignore_changes = [network_interface_id]
  }
}

# Dedicated public IP for direct SSH/admin access -- the load balancer's
# public IP only proxies ports 80/443 to the VM's private IP, so without
# this the VM would be unreachable for SSH.
resource "stackit_public_ip" "app_ssh" {
  project_id           = var.project_id
  network_interface_id = stackit_network_interface.app.network_interface_id
}

resource "stackit_server" "app" {
  project_id         = var.project_id
  name               = "${var.name_prefix}-app"
  machine_type       = data.stackit_machine_type.app_vm.name
  availability_zone  = var.vm_availability_zone
  keypair_name       = stackit_key_pair.app.name
  network_interfaces = [stackit_network_interface.app.network_interface_id]

  boot_volume = {
    size        = var.vm_boot_volume_size_gb
    source_type = "image"
    # data.stackit_image_v2.app_os.id is Terraform's internal composite ID
    # ("project_id,region,image_id"), not the bare image UUID the API wants
    # for boot_volume.source_id -- pull the last comma-separated segment.
    source_id             = element(split(",", data.stackit_image_v2.app_os.id), 2)
    delete_on_termination = true
  }

  user_data = local.cloud_init_rendered

  # user_data only runs once at first boot, and changing it forces a full
  # VM replace (new boot volume, new cloud-init run, brief downtime). Once
  # the VM is up, push config/image changes to the running system directly
  # (SSH + git pull + docker compose) instead of through tfvars -- ignore
  # drift here so routine variable edits don't trigger a surprise recreate.
  # See outputs.tf for the rendered_* outputs used to push updates manually.
  lifecycle {
    ignore_changes = [user_data]
  }
}
