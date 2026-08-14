output "load_balancer_ip" {
  description = "Public IP to point your DNS A records at: apex/wildcard for domain_name, plus saas./auth./oauthproxy. subdomains -- see README."
  value       = stackit_public_ip.lb.ip
}

output "app_vm_private_ip" {
  value = stackit_network_interface.app.ipv4
}

output "app_vm_ssh_ip" {
  description = "ssh ubuntu@<this> -i <your key>"
  value       = stackit_public_ip.app_ssh.ip
}

output "app_vm_server_id" {
  value = stackit_server.app.server_id
}

# user_data only runs on first boot (see compute.tf's lifecycle.ignore_changes),
# so changing tfvars after the VM exists does NOT push the new config
# automatically. Re-render and push manually:
#   terraform output -raw rendered_env_file > /tmp/.env
#   terraform output -raw rendered_compose_override > /tmp/docker-compose.stackit.yml
#   scp /tmp/.env ubuntu@<app_vm_ssh_ip>:/opt/saas-platform/repo/.env
#   scp /tmp/docker-compose.stackit.yml ubuntu@<app_vm_ssh_ip>:/opt/saas-platform/repo/infra/compose/
#   ssh ubuntu@<app_vm_ssh_ip> 'cd /opt/saas-platform/repo && set -a && source .env && set +a && \
#     docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.observability.yml \
#     -f infra/compose/docker-compose.tools.yml -f infra/compose/docker-compose.stackit.yml \
#     up -d --build --wait --scale app-db=0 --scale redis=0'
output "rendered_env_file" {
  value     = local.env_file_content
  sensitive = true
}

output "rendered_compose_override" {
  value     = local.compose_override_content
  sensitive = true # embeds keycloak_client_secret / redis_password / etc.
}

output "rendered_tenant_provisioner_secret" {
  value     = local.tenant_provisioner_secret_content
  sensitive = true
}
