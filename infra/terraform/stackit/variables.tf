# --- STACKIT account / auth ---------------------------------------------

variable "organization_id" {
  description = "STACKIT organization ID that owns the project below."
  type        = string
}

variable "project_id" {
  description = "STACKIT project ID to deploy into. Must already exist (Terraform cannot create the very first project in an org)."
  type        = string
}

variable "stackit_region" {
  description = "STACKIT region for regional services."
  type        = string
  default     = "eu01"
}

variable "stackit_service_account_key_path" {
  description = "Path to the service account key JSON file (key flow auth) used to authenticate the STACKIT provider."
  type        = string
}

# --- Naming ----------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix applied to all created resource names."
  type        = string
  default     = "saas-platform"
}

# --- Networking --------------------------------------------------------------

variable "network_ipv4_prefix" {
  description = "CIDR for the private network the app VM and load balancer share."
  type        = string
  default     = "192.168.20.0/24"
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach the app VM on port 22. Set to your own IP/32s -- do not leave it open to 0.0.0.0/0."
  type        = list(string)
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key uploaded to STACKIT for VM access (the matching private key is what you SSH in with)."
  type        = string
}

# --- Compute (app VM) --------------------------------------------------------

variable "vm_min_vcpus" {
  description = "Minimum vCPUs to look for when resolving a machine type for the app VM. Runs Traefik, oauth2-proxy, Keycloak+DB, app DB, Redis, Vault, Web, Workers, and k3s (tenant-provisioner) all on one host -- size up from riogentix's 4 vCPU default."
  type        = number
  default     = 6
}

variable "vm_min_ram_mb" {
  description = "Minimum RAM (MB) to look for when resolving a machine type for the app VM."
  type        = number
  default     = 16384
}

variable "vm_boot_volume_size_gb" {
  description = "Boot volume size in GB for the app VM. Needs headroom for the git checkout, Docker build cache/layers, k3s, and Postgres/Redis data volumes all on one disk."
  type        = number
  default     = 120
}

variable "vm_availability_zone" {
  type    = string
  default = "eu01-1"
}

variable "vm_image_name_regex" {
  description = "Regex used to resolve the boot image for the app VM. Match exactly (not a loose prefix) -- STACKIT's arm64 build is named e.g. 'Ubuntu 24.04 ARM64', which a loose '.*' suffix also matches and can sort first, then 400s \"flavor and image architecture do not match\" against an x86_64 machine type."
  type        = string
  default     = "^Ubuntu 24\\.04$"
}

# --- Source checkout ---------------------------------------------------------

variable "git_repo_url" {
  description = "SSH URL of the saas-scaffolding repo to clone on the VM (it's private -- see git_deploy_key_path)."
  type        = string
  default     = "git@github.com:pachu4u/saas-scaffolding.git"
}

variable "git_ref" {
  description = "Branch or tag to check out and build on first boot."
  type        = string
  default     = "main"
}

variable "git_deploy_key_path" {
  description = "Path to a read-only GitHub deploy-key private key (no passphrase) granted to pachu4u/saas-scaffolding, used by the VM to clone the repo. Generate with `ssh-keygen -t ed25519 -N '' -f ./stackit-deploy-key` and add the .pub as a read-only deploy key in the GitHub repo settings."
  type        = string
  sensitive   = true
}

# --- Domain / TLS ------------------------------------------------------------

variable "domain_name" {
  description = "Base public domain for this deployment, e.g. 'riogentix.com'. The platform itself is served at saas.<domain_name> and auth.<domain_name>; tenant instances live at <slug>.<domain_name>, app.<slug>.<domain_name>, and admin.<slug>.<domain_name>. A Cloudflare zone (see cloudflare_dns_api_token) enables DNS-01 wildcard issuance and automatic per-tenant DNS records; without it, certs fall back to per-SNI TLS-ALPN-01 (see acme_cert_resolver in locals.tf) and tenant DNS records must be created manually -- see README."
  type        = string
}

variable "acme_email" {
  description = "Email address used for the Let's Encrypt account Traefik registers on the VM."
  type        = string
}

variable "cloudflare_dns_api_token" {
  description = "Cloudflare API token (Zone:DNS:Edit scope) for the domain_name zone. Used both by Traefik's DNS-01 resolver and by the tenant-provisioner (apps/workers/src/provisioning/cloudflare-dns.ts) to create each tenant's grey-cloud wildcard A record on provision. Mutually exclusive with ionos_api_key -- set whichever matches domain_name's actual DNS host. Optional: leave both empty to deploy now and add one later (see locals.tf acme_cert_resolver) -- Traefik falls back to TLS-ALPN-01 per-host certs, and the tenant-provisioner's DNS step no-ops with a warning instead of failing."
  type        = string
  sensitive   = true
  default     = ""
}

variable "ionos_api_key" {
  description = "IONOS Web Hosting DNS API key (api.hosting.ionos.com/dns/v1), format 'publicPrefix.secret' -- generated at my.ionos.com (Web Hosting/Domains account, NOT cloud.ionos.com, which is a separate product with its own unrelated DNS zones). Alternative to cloudflare_dns_api_token for domain_name zones hosted on IONOS (nameservers ns*.ui-dns.*) rather than Cloudflare. Mutually exclusive with cloudflare_dns_api_token. Same optional/fallback behavior."
  type        = string
  sensitive   = true
  default     = ""
}

# --- Application secrets / integrations --------------------------------------

variable "keycloak_admin_username" {
  type    = string
  default = "admin"
}

variable "riogentix_image" {
  description = "Container image reference stamped out per tenant by the kubernetes provisioning driver, e.g. 'riogentixai/riogentix-backend:1.4.2'. Required for TENANT_STACK_DRIVER=kubernetes -- see apps/workers/src/provisioning/kubernetes-driver.ts."
  type        = string
}

variable "stripe_secret_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "stripe_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "stripe_publishable_key" {
  type    = string
  default = ""
}

variable "resend_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "email_from" {
  type    = string
  default = ""
}

variable "additional_secrets" {
  description = "Arbitrary extra key=value pairs appended to the VM's .env (e.g. OPENAI_API_KEY)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

# --- Managed data services (STACKIT Postgres Flex + Redis) -------------------
# The app's own database and cache move to STACKIT-managed services on this
# deployment (see database.tf) -- keycloak-db stays self-hosted in
# docker-compose, unchanged, matching techhanker.com.

variable "postgres_min_cpu" {
  description = "Minimum vCPUs when resolving a Postgres Flex flavor for the app database via stackit_postgresflex_flavors (database.tf)."
  type        = number
  default     = 2
}

variable "postgres_min_memory_gb" {
  description = "Minimum RAM (GiB) when resolving a Postgres Flex flavor."
  type        = number
  default     = 4
}

variable "postgres_storage_class" {
  description = "Storage class for the Postgres Flex instance. List classes available for a flavor with `stackit postgresflex flavor describe FLAVOR_ID` (STACKIT CLI) before first apply -- there's no Terraform data source for this."
  type        = string
  default     = "premium-perf2-stackit"
}

variable "postgres_storage_size_gb" {
  type    = number
  default = 10
}

variable "postgres_backup_schedule" {
  description = "Cron expression (numeric minute/hour) for the Postgres Flex daily backup."
  type        = string
  default     = "0 3 * * *"
}

variable "postgres_retention_days" {
  description = "How long Postgres Flex backups are retained. Must be between 32 and 90."
  type        = number
  default     = 32
}

variable "postgres_version" {
  description = "Matches the postgres:16-alpine image the self-hosted keycloak-db container still runs, for consistency."
  type        = string
  default     = "16"
}

variable "redis_plan_name" {
  description = "STACKIT Redis plan name, e.g. 'stackit-redis-1.2.10-single'. No Terraform data source lists these -- verify with `stackit redis plans` (STACKIT CLI) or the Portal before first apply."
  type        = string
}

variable "redis_version" {
  description = "Matches the redis:7-alpine image the base compose file's redis container used before this swap."
  type        = string
  default     = "7"
}

variable "managed_services_acl_cidrs" {
  description = "Extra CIDRs allowed to reach the managed Postgres Flex/Redis instances, in addition to network_ipv4_prefix. These ACLs filter on the connecting client's actual source IP -- since this project doesn't provision an org-level Network Area (see network.tf), that's the app VM's NAT egress IP, not its private IP, and isn't known until after first apply. Find it with `ssh ubuntu@<app_vm_ssh_ip> curl -s ifconfig.me` post-apply, add it here, and re-apply."
  type        = list(string)
  default     = []
}
