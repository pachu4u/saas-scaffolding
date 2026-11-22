import type {
  V1Deployment,
  V1Ingress,
  V1LimitRange,
  V1Namespace,
  V1NetworkPolicy,
  V1ResourceQuota,
  V1RoleBinding,
  V1Secret,
  V1Service,
} from '@kubernetes/client-node';

import type { TenantStackSpec } from './types.js';

/**
 * Pure renderer: TenantStackSpec → the five Kubernetes objects that make up a
 * tenant stack. No cluster or env access — unit-testable in isolation.
 *
 * Naming is deterministic so re-rendering the same spec always addresses the
 * same objects (server-side apply then converges instead of duplicating).
 */

export const DEPLOYMENT_NAME = 'riogentix';
export const SERVICE_NAME = 'riogentix';
export const SECRET_NAME = 'riogentix-env';
export const TLS_SECRET_NAME = 'riogentix-tls';
export const ROLE_BINDING_NAME = 'saas-tenant-workload';
export const IMAGE_PULL_SECRET_NAME = 'riogentix-image-pull';
export const NETWORK_POLICY_NAME = 'tenant-isolation';
export const QUOTA_NAME = 'tenant-quota';
export const LIMIT_RANGE_NAME = 'tenant-limits';

/**
 * The Riogentix image is a UBI Python image whose home dir
 * (/opt/app-root/src) is owned by uid 1001, gid 0 -- run as that user
 * instead of the image's default root.
 */
const RUN_AS_USER = 1001;
const CONFIG_DIR = '/opt/app-root/src/.cache/riogentix';

/** Never reachable from a tenant pod: cluster, node, docker, VPC, metadata. */
export const ALWAYS_DENIED_CIDRS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10',
  '169.254.0.0/16',
];

/** Pod network gateway on k3s's default flannel CIDR -- where kubelet probes come from. */
const NODE_PROBE_SOURCE = '10.42.0.1/32';

// Must match infra/k8s/tenant-provisioner/{serviceaccount,rbac}.yaml — the
// identity every tenant's per-namespace RoleBinding grants workload access
// to (see infra/k8s/tenant-provisioner/rbac.yaml for why this can't just be
// a cluster-wide grant).
const WORKER_SERVICE_ACCOUNT = 'saas-workers';
const WORKER_NAMESPACE = 'saas-platform';

function labels(spec: TenantStackSpec): Record<string, string> {
  return {
    'app.kubernetes.io/name': 'riogentix',
    'app.kubernetes.io/managed-by': 'saas-provisioner',
    'saas.platform/tenant-id': spec.tenantId,
    'saas.platform/tenant-slug': spec.slug,
  };
}

export function renderNamespace(spec: TenantStackSpec): V1Namespace {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: spec.namespace, labels: labels(spec) },
  };
}

/**
 * Grants saas-workers the saas-tenant-workload ClusterRole (secrets/services/
 * deployments/ingresses CRUD) scoped to this tenant's namespace only — the
 * per-namespace half of the RBAC split described in
 * infra/k8s/tenant-provisioner/rbac.yaml. Must apply before the Secret/
 * Deployment/Service/Ingress below, since the driver's own ServiceAccount
 * needs this binding in place to create them.
 */
export function renderRoleBinding(spec: TenantStackSpec): V1RoleBinding {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { name: ROLE_BINDING_NAME, namespace: spec.namespace, labels: labels(spec) },
    roleRef: {
      apiGroup: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: ROLE_BINDING_NAME,
    },
    subjects: [
      { kind: 'ServiceAccount', name: WORKER_SERVICE_ACCOUNT, namespace: WORKER_NAMESPACE },
    ],
  };
}

export function renderSecret(spec: TenantStackSpec): V1Secret {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: SECRET_NAME, namespace: spec.namespace, labels: labels(spec) },
    type: 'Opaque',
    stringData: spec.secretEnv,
  };
}

/**
 * Pull credentials for `spec.image`'s registry, when private (e.g. STACKIT's
 * Harbor instance) — undefined when spec.imagePullCredentials wasn't set,
 * meaning the image is public and no secret/imagePullSecrets reference is
 * needed at all.
 */
export function renderImagePullSecret(spec: TenantStackSpec): V1Secret | undefined {
  const creds = spec.imagePullCredentials;
  if (!creds) return undefined;
  const dockerconfigjson = JSON.stringify({
    auths: {
      [creds.registry]: {
        username: creds.username,
        password: creds.password,
        auth: Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
      },
    },
  });
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: IMAGE_PULL_SECRET_NAME, namespace: spec.namespace, labels: labels(spec) },
    type: 'kubernetes.io/dockerconfigjson',
    stringData: { '.dockerconfigjson': dockerconfigjson },
  };
}

export function renderDeployment(spec: TenantStackSpec): V1Deployment {
  const selector = {
    'app.kubernetes.io/name': 'riogentix',
    'saas.platform/tenant-slug': spec.slug,
  };
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: DEPLOYMENT_NAME, namespace: spec.namespace, labels: labels(spec) },
    spec: {
      replicas: 1,
      selector: { matchLabels: selector },
      strategy: { type: 'RollingUpdate' },
      template: {
        metadata: { labels: { ...labels(spec) } },
        spec: {
          // Service links inject RIOGENTIX_PORT=tcp://... (from the
          // `riogentix` Service), which Riogentix's settings parse as its
          // listen port and crash on. Env must come only from the secret.
          enableServiceLinks: false,
          // Tenant code (user-supplied Python) never needs the Kubernetes API.
          automountServiceAccountToken: false,
          securityContext: {
            runAsNonRoot: true,
            runAsUser: RUN_AS_USER,
            runAsGroup: 0,
            fsGroup: RUN_AS_USER,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          volumes: [
            { name: 'riogentix-config', emptyDir: { sizeLimit: '1Gi' } },
            { name: 'tmp', emptyDir: { sizeLimit: '2Gi' } },
          ],
          ...(spec.imagePullCredentials && {
            imagePullSecrets: [{ name: IMAGE_PULL_SECRET_NAME }],
          }),
          containers: [
            {
              name: 'riogentix',
              image: spec.image,
              // The image's default CMD (docker/dev.start.sh) starts a Vite
              // dev server on :3000 and leaves the backend (:7860, this
              // container's port) with no frontend route, so / 404s. The
              // image already has the frontend prebuilt into the backend's
              // static dir — boot straight into the factory that serves it,
              // matching docker/k8s.start.sh's production entrypoint.
              // The venv's uvicorn directly, not `uv run`: uv may try to
              // sync/write the root-owned venv, which fails as non-root.
              command: [
                '/app/.venv/bin/uvicorn',
                '--factory',
                'riogentix.main:setup_app',
                '--host',
                '0.0.0.0',
                '--port',
                String(spec.containerPort),
                '--loop',
                'asyncio',
              ],
              ports: [{ containerPort: spec.containerPort, name: 'http' }],
              envFrom: [{ secretRef: { name: SECRET_NAME } }],
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: { drop: ['ALL'] },
              },
              volumeMounts: [
                { name: 'riogentix-config', mountPath: CONFIG_DIR },
                { name: 'tmp', mountPath: '/tmp' },
              ],
              resources: {
                requests: { cpu: '100m', memory: '256Mi' },
                limits: { cpu: spec.cpuLimit, memory: spec.memoryLimit },
              },
              // Riogentix can take minutes on first boot (migrations, and the
              // dev image installs dependencies at startup) — the startup
              // probe holds liveness off until /health first responds, so a
              // slow boot doesn't become a restart loop.
              startupProbe: {
                httpGet: { path: '/health', port: 'http' },
                periodSeconds: 10,
                failureThreshold: 90,
              },
              readinessProbe: {
                httpGet: { path: '/health', port: 'http' },
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: { path: '/health', port: 'http' },
                periodSeconds: 30,
              },
            },
          ],
        },
      },
    },
  };
}

export function renderService(spec: TenantStackSpec): V1Service {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: SERVICE_NAME, namespace: spec.namespace, labels: labels(spec) },
    spec: {
      selector: {
        'app.kubernetes.io/name': 'riogentix',
        'saas.platform/tenant-slug': spec.slug,
      },
      ports: [{ name: 'http', port: 80, targetPort: 'http' }],
    },
  };
}

/**
 * `app.{host}`, e.g. app.acme.techhanker.com — a dedicated, unprefixed host
 * for Riogentix so it can be reached at root instead of `{host}/app`. Traefik
 * routes this host straight to the k8s-ingress NodePort (see
 * infra/compose/traefik/dynamic/acme-tenant-subdomains.yml for the acme
 * example); ingress-nginx needs a matching rule here or it 404s the request.
 */
function appHost(spec: TenantStackSpec): string {
  return `app.${spec.host}`;
}

export function renderIngress(spec: TenantStackSpec): V1Ingress {
  const hosts = [spec.host, appHost(spec)];
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: 'riogentix',
      namespace: spec.namespace,
      labels: labels(spec),
      ...(spec.certManagerIssuer && {
        annotations: { 'cert-manager.io/cluster-issuer': spec.certManagerIssuer },
      }),
    },
    spec: {
      ingressClassName: spec.ingressClassName,
      // TLS only when cert-manager issues a per-host cert; otherwise the
      // wildcard cert terminated at the ingress controller covers the host.
      ...(spec.certManagerIssuer && {
        tls: [{ hosts, secretName: TLS_SECRET_NAME }],
      }),
      rules: hosts.map((host) => ({
        host,
        http: {
          paths: [
            {
              path: '/',
              pathType: 'Prefix',
              backend: { service: { name: SERVICE_NAME, port: { name: 'http' } } },
            },
          ],
        },
      })),
    },
  };
}

/**
 * Default-deny for the tenant namespace. In: only ingress-nginx, the
 * provisioner (saas-platform namespace) and kubelet probes. Out: cluster DNS,
 * and the public internet minus private ranges and `spec.egressDenyCidrs`
 * -- so no other tenant, the k8s API, the node, the docker network (Keycloak
 * admin, web) or cloud metadata. The tenant's Postgres Flex endpoint is a
 * public address and stays reachable; its login only opens its own DB.
 * Enforced by k3s's embedded kube-router network-policy controller.
 */
export function renderNetworkPolicy(spec: TenantStackSpec): V1NetworkPolicy {
  const ns = (name: string) => ({
    namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': name } },
  });
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: NETWORK_POLICY_NAME, namespace: spec.namespace, labels: labels(spec) },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress', 'Egress'],
      ingress: [
        {
          _from: [
            ns('ingress-nginx'),
            ns(WORKER_NAMESPACE),
            { ipBlock: { cidr: NODE_PROBE_SOURCE } },
          ],
        },
      ],
      egress: [
        {
          to: [{ ...ns('kube-system'), podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } } }],
          ports: [
            { protocol: 'UDP', port: 53 },
            { protocol: 'TCP', port: 53 },
          ],
        },
        {
          to: [
            {
              ipBlock: {
                cidr: '0.0.0.0/0',
                except: [...ALWAYS_DENIED_CIDRS, ...(spec.egressDenyCidrs ?? [])],
              },
            },
          ],
        },
      ],
    },
  };
}

/** "2" -> "4", "4Gi" -> "8Gi", "500m" -> "1000m": room for a rolling update's second pod. */
export function doubleQuantity(q: string): string {
  const m = /^(\d+(?:\.\d+)?)([a-zA-Z]*)$/.exec(q.trim());
  if (!m) throw new Error(`Unsupported resource quantity ${JSON.stringify(q)}`);
  const [, num = '0', unit = ''] = m;
  return `${String(Number(num) * 2)}${unit}`;
}

/**
 * Caps the whole namespace at two pods' worth of the per-pod limit (one
 * running + one during a rolling update), so a tenant can't scale itself
 * or spawn extra workloads to starve the node.
 */
export function renderResourceQuota(spec: TenantStackSpec): V1ResourceQuota {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: { name: QUOTA_NAME, namespace: spec.namespace, labels: labels(spec) },
    spec: {
      hard: {
        pods: '4',
        'limits.cpu': doubleQuantity(spec.cpuLimit),
        'limits.memory': doubleQuantity(spec.memoryLimit),
        'requests.cpu': doubleQuantity(spec.cpuLimit),
        'requests.memory': doubleQuantity(spec.memoryLimit),
        'requests.storage': '0',
        persistentvolumeclaims: '0',
        'services.loadbalancers': '0',
        'services.nodeports': '0',
      },
    },
  };
}

/** Defaults for any container that doesn't set its own requests/limits (quota requires them). */
export function renderLimitRange(spec: TenantStackSpec): V1LimitRange {
  return {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: { name: LIMIT_RANGE_NAME, namespace: spec.namespace, labels: labels(spec) },
    spec: {
      limits: [
        {
          type: 'Container',
          _default: { cpu: '500m', memory: '512Mi' },
          defaultRequest: { cpu: '100m', memory: '128Mi' },
          max: { cpu: spec.cpuLimit, memory: spec.memoryLimit },
        },
      ],
    },
  };
}

/**
 * All objects in apply order — namespace first, then the RoleBinding that
 * grants saas-workers permission to create everything after it. The image
 * pull secret is only present when spec.imagePullCredentials was set (a
 * private-registry image); a public image needs no such object at all.
 */
export function renderTenantManifests(
  spec: TenantStackSpec,
): (
  | V1Namespace
  | V1RoleBinding
  | V1NetworkPolicy
  | V1ResourceQuota
  | V1LimitRange
  | V1Secret
  | V1Deployment
  | V1Service
  | V1Ingress
)[] {
  const imagePullSecret = renderImagePullSecret(spec);
  return [
    renderNamespace(spec),
    renderRoleBinding(spec),
    // Isolation and limits exist before the first pod is scheduled.
    renderNetworkPolicy(spec),
    renderResourceQuota(spec),
    renderLimitRange(spec),
    renderSecret(spec),
    ...(imagePullSecret ? [imagePullSecret] : []),
    renderDeployment(spec),
    renderService(spec),
    renderIngress(spec),
  ];
}
