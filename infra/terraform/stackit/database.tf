# STACKIT-managed Postgres Flex (app DB) and Redis, replacing the app-db and
# redis containers from the base docker-compose.yml on THIS deployment only.
# Those two services stay defined in the (untouched) base compose file, but
# are started with `--scale app-db=0 --scale redis=0` in bootstrap.sh -- see
# the `depends_on` overrides in docker-compose.stackit.yml.tftpl for why that
# doesn't hang `docker compose up --wait` on web/workers. keycloak-db is
# NOT touched here and stays self-hosted, matching techhanker.com.
#
# Access control: both instances' ACLs allow network_ipv4_prefix (in case the
# routed private network reaches STACKIT platform services directly) plus
# whatever's in var.managed_services_acl_cidrs. Neither has been verified
# against a real STACKIT project yet -- if the app VM's actual egress path is
# a public NAT IP instead, add it to managed_services_acl_cidrs after first
# apply (see that variable's description) and re-apply before running
# migrations.

data "stackit_postgresflex_flavors" "app_db" {
  project_id = var.project_id
}

locals {
  postgres_flavor_id = one([
    for f in data.stackit_postgresflex_flavors.app_db.flavors :
    f.id if f.cpu == var.postgres_min_cpu && f.memory == var.postgres_min_memory_gb && f.node_type == "Single"
  ])

  managed_services_acl = distinct(concat([var.network_ipv4_prefix], var.managed_services_acl_cidrs))
}

resource "stackit_postgresflex_instance" "app_db" {
  project_id      = var.project_id
  name            = "${var.name_prefix}-app-db"
  flavor_id       = local.postgres_flavor_id
  backup_schedule = var.postgres_backup_schedule
  retention_days  = var.postgres_retention_days
  version         = var.postgres_version

  storage = {
    class = var.postgres_storage_class
    size  = var.postgres_storage_size_gb
  }

  network = {
    acl = local.managed_services_acl
  }
}

resource "stackit_postgresflex_user" "app_db" {
  project_id  = var.project_id
  instance_id = stackit_postgresflex_instance.app_db.instance_id
  username    = "saas_platform"
  roles       = ["login"]
}

resource "stackit_postgresflex_database" "app_db" {
  project_id  = var.project_id
  instance_id = stackit_postgresflex_instance.app_db.instance_id
  name        = "saas_platform"
  owner       = stackit_postgresflex_user.app_db.username
}

resource "stackit_redis_instance" "app_redis" {
  project_id = var.project_id
  name       = "${var.name_prefix}-redis"
  version    = var.redis_version
  plan_name  = var.redis_plan_name

  parameters = {
    sgw_acl          = join(",", local.managed_services_acl)
    maxmemory_policy = "noeviction" # matches the self-hosted container's --maxmemory-policy noeviction
  }
}

resource "stackit_redis_credential" "app_redis" {
  project_id  = var.project_id
  instance_id = stackit_redis_instance.app_redis.instance_id
}
