locals {
  # Used inside HostRegexp() rules in the Traefik dynamic config templates --
  # the literal "." in var.domain_name must be regex-escaped, same as the
  # techhanker.com host's dynamic/*.yml files (\\.techhanker\\.com$). This
  # value gets substituted into a YAML double-quoted string by templatefile()
  # with no further escaping applied, so it must already carry the DOUBLED
  # backslash a YAML double-quoted string needs (YAML unescapes "\\\\" to a
  # single "\" -- if this were a single backslash instead, YAML would try to
  # parse "\." as an (invalid) escape sequence and fail to load the file).
  domain_regex = replace(var.domain_name, ".", "\\\\.")

  # STACKIT-managed Postgres Flex + Redis connection strings -- see
  # database.tf. Unlike the self-hosted app-db container these are reachable
  # from anywhere with network access (not just the platform Docker network),
  # so the same DATABASE_URL now works for both host-side tools (Prisma
  # CLI) and containers -- no more localhost:5434-vs-app-db:5432 split.
  app_database_url = "postgresql://${stackit_postgresflex_user.app_db.username}:${urlencode(stackit_postgresflex_user.app_db.password)}@${stackit_postgresflex_instance.app_db.connection_info.write.host}:${stackit_postgresflex_instance.app_db.connection_info.write.port}/${stackit_postgresflex_database.app_db.name}?sslmode=require"
  app_redis_url    = stackit_redis_credential.app_redis.uri

  common_template_vars = {
    domain_name      = var.domain_name
    domain_regex     = local.domain_regex
    acme_email       = var.acme_email
    git_ref          = var.git_ref
    load_balancer_ip = stackit_public_ip.lb.ip

    keycloak_admin_username  = var.keycloak_admin_username
    riogentix_image          = var.riogentix_image
    cloudflare_dns_api_token = var.cloudflare_dns_api_token

    stripe_secret_key      = var.stripe_secret_key
    stripe_webhook_secret  = var.stripe_webhook_secret
    stripe_publishable_key = var.stripe_publishable_key
    resend_api_key         = var.resend_api_key
    email_from             = var.email_from

    auth_secret                    = random_password.auth_secret.result
    platform_internal_secret       = random_password.platform_internal_secret.result
    keycloak_client_secret         = random_password.keycloak_client_secret.result
    keycloak_admin_password        = random_password.keycloak_admin_password.result
    oauth2_proxy_client_secret     = random_password.oauth2_proxy_client_secret.result
    oauth2_proxy_cookie_secret     = random_id.oauth2_proxy_cookie_secret.b64_std
    riogentix_saas_internal_secret = random_password.riogentix_saas_internal_secret.result
    riogentix_internal_secret      = random_password.riogentix_internal_secret.result
    keycloak_db_password           = random_password.keycloak_db_password.result

    database_url   = local.app_database_url
    redis_url      = local.app_redis_url
    redis_password = stackit_redis_credential.app_redis.password
  }

  env_file_content = templatefile("${path.module}/templates/env.tftpl", merge(local.common_template_vars, {
    additional_secrets = var.additional_secrets
  }))

  compose_override_content = templatefile("${path.module}/templates/docker-compose.stackit.yml.tftpl", local.common_template_vars)

  traefik_static_content            = templatefile("${path.module}/templates/traefik.yaml.tftpl", local.common_template_vars)
  dynamic_web_content               = templatefile("${path.module}/templates/dynamic-web.yaml.tftpl", local.common_template_vars)
  dynamic_keycloak_content          = templatefile("${path.module}/templates/dynamic-keycloak.yaml.tftpl", local.common_template_vars)
  dynamic_riogentix_tenants_content = templatefile("${path.module}/templates/dynamic-riogentix-tenants.yaml.tftpl", local.common_template_vars)
  dynamic_tenant_app_admin_content  = templatefile("${path.module}/templates/dynamic-tenant-app-admin-subdomains.yaml.tftpl", local.common_template_vars)
  dynamic_tls_content               = templatefile("${path.module}/templates/dynamic-tls.yaml.tftpl", local.common_template_vars)

  tenant_provisioner_secret_content = templatefile("${path.module}/templates/tenant-provisioner-secret.env.tftpl", local.common_template_vars)

  bootstrap_script_content = templatefile("${path.module}/templates/bootstrap.sh.tftpl", {
    git_repo_url = var.git_repo_url
    git_ref      = var.git_ref
  })

  cloud_init_rendered = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    deploy_key_b64                = base64encode(chomp(file(var.git_deploy_key_path)))
    env_file_b64                  = base64encode(local.env_file_content)
    compose_override_b64          = base64encode(local.compose_override_content)
    traefik_static_b64            = base64encode(local.traefik_static_content)
    dynamic_web_b64               = base64encode(local.dynamic_web_content)
    dynamic_keycloak_b64          = base64encode(local.dynamic_keycloak_content)
    dynamic_riogentix_tenants_b64 = base64encode(local.dynamic_riogentix_tenants_content)
    dynamic_tenant_app_admin_b64  = base64encode(local.dynamic_tenant_app_admin_content)
    dynamic_tls_b64               = base64encode(local.dynamic_tls_content)
    tenant_provisioner_secret_b64 = base64encode(local.tenant_provisioner_secret_content)
    bootstrap_script_b64          = base64encode(local.bootstrap_script_content)
  })
}
