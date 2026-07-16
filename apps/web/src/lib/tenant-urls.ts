/**
 * Public URL of a tenant's Riogentix application instance. Since the
 * {slug}.techhanker.com hosts were repointed at the per-tenant k8s
 * deployments, each tenant's app lives on its own subdomain of the platform
 * base domain (derived from AUTH_URL, e.g. "saas.techhanker.com" →
 * "techhanker.com"). Falls back to the legacy shared RIOGENTIX_PUBLIC_URL
 * when no base domain can be derived.
 */
export function tenantAppUrl(slug: string): string | undefined {
  const authHost = process.env.AUTH_URL
    ? (() => {
        try {
          return new URL(process.env.AUTH_URL).hostname;
        } catch {
          return '';
        }
      })()
    : '';
  const baseDomain = authHost.split('.').slice(1).join('.');
  if (!baseDomain) return process.env.RIOGENTIX_PUBLIC_URL ?? undefined;
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${proto}://${slug}.${baseDomain}`;
}
