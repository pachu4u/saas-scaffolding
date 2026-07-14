import type {
  V1Deployment,
  V1Ingress,
  V1Namespace,
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

export function renderSecret(spec: TenantStackSpec): V1Secret {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: SECRET_NAME, namespace: spec.namespace, labels: labels(spec) },
    type: 'Opaque',
    stringData: spec.secretEnv,
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
          containers: [
            {
              name: 'riogentix',
              image: spec.image,
              ports: [{ containerPort: spec.containerPort, name: 'http' }],
              envFrom: [{ secretRef: { name: SECRET_NAME } }],
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

export function renderIngress(spec: TenantStackSpec): V1Ingress {
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
        tls: [{ hosts: [spec.host], secretName: TLS_SECRET_NAME }],
      }),
      rules: [
        {
          host: spec.host,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: { service: { name: SERVICE_NAME, port: { name: 'http' } } },
              },
            ],
          },
        },
      ],
    },
  };
}

/** All objects in apply order (namespace first). */
export function renderTenantManifests(
  spec: TenantStackSpec,
): [V1Namespace, V1Secret, V1Deployment, V1Service, V1Ingress] {
  return [
    renderNamespace(spec),
    renderSecret(spec),
    renderDeployment(spec),
    renderService(spec),
    renderIngress(spec),
  ];
}
