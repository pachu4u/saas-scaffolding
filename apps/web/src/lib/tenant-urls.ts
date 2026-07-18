/**
 * Link that opens the current tenant's Riogentix application, authenticated.
 * Riogentix now lives at the /app path on the tenant subdomain (routed
 * straight to the per-tenant k8s instance at the edge, bypassing this app),
 * so this just points at the same-origin SSO bridge
 * (/api/riogentix-launch) which exchanges the caller's SaaS session for a
 * Riogentix session cookie before redirecting to /app. `slug` is accepted
 * for backwards compatibility with existing call sites but unused — the
 * launch endpoint resolves the tenant from the session itself.
 */
export function tenantAppUrl(_slug: string): string | undefined {
  return '/api/riogentix-launch';
}
