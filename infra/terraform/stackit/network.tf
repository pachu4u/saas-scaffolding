# Note: an org-level stackit_network_area (SNA) resource is deliberately
# skipped here -- it requires org-level permissions beyond a project-scoped
# "owner" role, and nothing else in this config references it. The
# project-scoped network below is sufficient for Vault/k3s (containers/pods
# on the single app VM), the load balancer, and SSH -- see database.tf's
# comment on managed_services_acl_cidrs for how Postgres Flex/Redis access
# control interacts (or doesn't) with this network in the absence of an SNA.
resource "stackit_network" "main" {
  project_id  = var.project_id
  name        = "${var.name_prefix}-network"
  ipv4_prefix = var.network_ipv4_prefix
  routed      = true
}

resource "stackit_key_pair" "app" {
  name       = "${var.name_prefix}-app-key"
  public_key = chomp(file(var.ssh_public_key_path))
}

resource "stackit_security_group" "app" {
  project_id = var.project_id
  name       = "${var.name_prefix}-app-sg"
  stateful   = true
}

# This ISP rotates between several egress IPs -- allow all observed ones
# (var.ssh_allowed_cidrs) instead of chasing the active one on every apply.
resource "stackit_security_group_rule" "ssh_in" {
  for_each = toset(var.ssh_allowed_cidrs)

  project_id        = var.project_id
  security_group_id = stackit_security_group.app.security_group_id
  direction         = "ingress"
  ether_type        = "IPv4"
  ip_range          = each.value
  protocol          = { name = "tcp" }
  port_range        = { min = 22, max = 22 }
}

resource "stackit_security_group_rule" "http_in" {
  project_id        = var.project_id
  security_group_id = stackit_security_group.app.security_group_id
  direction         = "ingress"
  ether_type        = "IPv4"
  ip_range          = var.network_ipv4_prefix # traffic arrives via the load balancer over the private network
  protocol          = { name = "tcp" }
  port_range        = { min = 80, max = 80 }
}

resource "stackit_security_group_rule" "https_in" {
  project_id        = var.project_id
  security_group_id = stackit_security_group.app.security_group_id
  direction         = "ingress"
  ether_type        = "IPv4"
  ip_range          = var.network_ipv4_prefix
  protocol          = { name = "tcp" }
  port_range        = { min = 443, max = 443 }
}

# No explicit egress-all rule here: STACKIT auto-creates a default allow-all
# egress rule on new security groups, and an explicit duplicate 409s.
