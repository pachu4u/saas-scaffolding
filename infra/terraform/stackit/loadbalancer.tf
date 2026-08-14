# Plain L4 TCP passthrough on 80/443 to the app VM. TLS termination and all
# HTTP routing happen on the VM via Traefik + Cloudflare DNS-01 ACME (see
# templates/traefik.yaml.tftpl) -- this mirrors the existing
# infra/compose/traefik pattern rather than terminating TLS at the STACKIT
# load balancer.
resource "stackit_loadbalancer" "app" {
  project_id = var.project_id
  name       = "${var.name_prefix}-lb"
  plan_id    = "p10" # verify with `stackit load-balancer plans` -- not guaranteed stable across regions/accounts

  target_pools = [
    {
      name        = "app-http"
      target_port = 80
      targets = [{
        display_name = stackit_server.app.name
        ip           = stackit_network_interface.app.ipv4
      }]
      active_health_check = {
        healthy_threshold   = 3
        interval            = "5s"
        interval_jitter     = "1s"
        timeout             = "3s"
        unhealthy_threshold = 3
      }
    },
    {
      name        = "app-https"
      target_port = 443
      targets = [{
        display_name = stackit_server.app.name
        ip           = stackit_network_interface.app.ipv4
      }]
      active_health_check = {
        healthy_threshold   = 3
        interval            = "5s"
        interval_jitter     = "1s"
        timeout             = "3s"
        unhealthy_threshold = 3
      }
    }
  ]

  listeners = [
    {
      display_name = "http"
      port         = 80
      protocol     = "PROTOCOL_TCP"
      target_pool  = "app-http"
    },
    {
      display_name = "https"
      port         = 443
      protocol     = "PROTOCOL_TCP"
      target_pool  = "app-https"
    }
  ]

  networks = [
    {
      network_id = stackit_network.main.network_id
      role       = "ROLE_LISTENERS_AND_TARGETS"
    }
  ]

  external_address = stackit_public_ip.lb.ip

  options = {
    private_network_only = false
  }
}
