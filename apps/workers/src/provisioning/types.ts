/**
 * Per-tenant stack provisioning drivers.
 *
 * A driver owns the lifecycle of the Riogentix instance(s) backing a tenant:
 *  - 'shared'     — legacy topology: every tenant lives in one shared Riogentix
 *                   deployment; provisioning is an idempotent HTTP upsert.
 *  - 'kubernetes' — dedicated stack per tenant: Namespace + Secret + Deployment
 *                   + Service + Ingress stamped into the cluster, plus a
 *                   dedicated database on the shared Postgres server.
 *
 * The queue handler is driver-agnostic: it only manages the tenant/environment
 * state machine and delegates the infrastructure work here.
 */

export interface TenantRef {
  id: string;
  slug: string;
  plan: string;
}

export interface ProvisionOutcome {
  /**
   * Public base URL for the tenant's instance (e.g. https://acme.example.com),
   * or null when the driver has no opinion (shared topology — the tenant is
   * served by the platform's own wildcard domain).
   */
  publicUrl: string | null;
}

export interface TenantStackDriver {
  readonly name: 'shared' | 'kubernetes';
  /** Idempotent: safe to call again for retries or re-provisioning. */
  provision(tenant: TenantRef): Promise<ProvisionOutcome>;
  /** Idempotent: tears down compute/routing. Data (database) is retained. */
  deprovision(tenant: Pick<TenantRef, 'id' | 'slug'>): Promise<void>;
}

/** Everything the manifest renderer needs — pure data, no env access. */
export interface TenantStackSpec {
  tenantId: string;
  slug: string;
  plan: string;
  namespace: string;
  /** Public hostname, e.g. acme.example.com */
  host: string;
  image: string;
  containerPort: number;
  ingressClassName: string;
  /** cert-manager ClusterIssuer name; omit to rely on a wildcard cert at the ingress controller */
  certManagerIssuer?: string;
  cpuLimit: string;
  memoryLimit: string;
  /** Values that land in the per-tenant Secret (injected via envFrom). */
  secretEnv: Record<string, string>;
}
