import { describe, expect, it } from 'vitest';

import {
  DEPLOYMENT_NAME,
  IMAGE_PULL_SECRET_NAME,
  SECRET_NAME,
  SERVICE_NAME,
  renderDeployment,
  renderImagePullSecret,
  renderIngress,
  renderNamespace,
  renderRoleBinding,
  renderSecret,
  renderService,
  renderTenantManifests,
} from './manifests.js';
import type { TenantStackSpec } from './types.js';

function spec(overrides?: Partial<TenantStackSpec>): TenantStackSpec {
  return {
    tenantId: '9b1c2f10-0000-0000-0000-000000000001',
    slug: 'acme-co',
    plan: 'pro',
    namespace: 't-acme-co',
    host: 'acme-co.example.com',
    image: 'registry.example.com/riogentix:1.4.2',
    containerPort: 8000,
    ingressClassName: 'nginx',
    cpuLimit: '1',
    memoryLimit: '1Gi',
    secretEnv: {
      RIOGENTIX_DATABASE_URL: 'postgresql://rg_acme_co:pw@db:5432/riogentix_acme_co',
      RIOGENTIX_INTERNAL_SECRET: 'internal-secret-value',
    },
    ...overrides,
  };
}

describe('renderTenantManifests', () => {
  it('renders the six stack objects in apply order (namespace and RoleBinding first)', () => {
    const kinds = renderTenantManifests(spec()).map((m) => m.kind);
    expect(kinds).toEqual([
      'Namespace',
      'RoleBinding',
      'Secret',
      'Deployment',
      'Service',
      'Ingress',
    ]);
  });

  it('inserts the image pull secret (after the app Secret, before the Deployment) when imagePullCredentials is set', () => {
    const kinds = renderTenantManifests(
      spec({
        imagePullCredentials: {
          registry: 'registry.example.com',
          username: 'robot$pull',
          password: 'p@ss',
        },
      }),
    ).map((m) => m.kind);
    expect(kinds).toEqual([
      'Namespace',
      'RoleBinding',
      'Secret',
      'Secret',
      'Deployment',
      'Service',
      'Ingress',
    ]);
  });

  it('is deterministic — same spec renders identical objects', () => {
    expect(renderTenantManifests(spec())).toEqual(renderTenantManifests(spec()));
  });
});

describe('renderImagePullSecret', () => {
  it('returns undefined when the spec has no imagePullCredentials (public image)', () => {
    expect(renderImagePullSecret(spec())).toBeUndefined();
  });

  it('renders a dockerconfigjson Secret keyed by the registry host', () => {
    const secret = renderImagePullSecret(
      spec({
        imagePullCredentials: {
          registry: 'registry.example.com',
          username: 'robot$pull',
          password: 'p@ss',
        },
      }),
    );
    expect(secret?.metadata?.name).toBe(IMAGE_PULL_SECRET_NAME);
    expect(secret?.metadata?.namespace).toBe('t-acme-co');
    expect(secret?.type).toBe('kubernetes.io/dockerconfigjson');
    const config = JSON.parse(secret?.stringData?.['.dockerconfigjson'] ?? '{}') as {
      auths: Record<string, { username: string; password: string; auth: string }>;
    };
    expect(config.auths['registry.example.com']).toEqual({
      username: 'robot$pull',
      password: 'p@ss',
      auth: Buffer.from('robot$pull:p@ss').toString('base64'),
    });
  });
});

describe('renderNamespace', () => {
  it('names the namespace from the spec and labels it with tenant identity', () => {
    const ns = renderNamespace(spec());
    expect(ns.metadata?.name).toBe('t-acme-co');
    expect(ns.metadata?.labels).toMatchObject({
      'saas.platform/tenant-id': '9b1c2f10-0000-0000-0000-000000000001',
      'saas.platform/tenant-slug': 'acme-co',
      'app.kubernetes.io/managed-by': 'saas-provisioner',
    });
  });
});

describe('renderRoleBinding', () => {
  it('grants saas-workers the saas-tenant-workload ClusterRole scoped to this namespace only', () => {
    const rb = renderRoleBinding(spec());
    expect(rb.metadata?.namespace).toBe('t-acme-co');
    expect(rb.roleRef).toEqual({
      apiGroup: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: 'saas-tenant-workload',
    });
    expect(rb.subjects).toEqual([
      { kind: 'ServiceAccount', name: 'saas-workers', namespace: 'saas-platform' },
    ]);
  });
});

describe('renderSecret', () => {
  it('carries the secret env verbatim as stringData', () => {
    const secret = renderSecret(spec());
    expect(secret.metadata?.name).toBe(SECRET_NAME);
    expect(secret.metadata?.namespace).toBe('t-acme-co');
    expect(secret.stringData).toEqual(spec().secretEnv);
  });
});

describe('renderDeployment', () => {
  it('selector matches the pod template labels', () => {
    const deployment = renderDeployment(spec());
    const selector = deployment.spec?.selector.matchLabels ?? {};
    const podLabels = deployment.spec?.template.metadata?.labels ?? {};
    for (const [key, value] of Object.entries(selector)) {
      expect(podLabels[key]).toBe(value);
    }
  });

  it('injects the secret via envFrom and pins image, port, and limits', () => {
    const container = renderDeployment(spec()).spec?.template.spec?.containers[0];
    expect(container?.image).toBe('registry.example.com/riogentix:1.4.2');
    expect(container?.ports?.[0]?.containerPort).toBe(8000);
    expect(container?.envFrom?.[0]?.secretRef?.name).toBe(SECRET_NAME);
    expect(container?.resources?.limits).toEqual({ cpu: '1', memory: '1Gi' });
  });

  it('disables service links so RIOGENTIX_PORT is not injected by the Service', () => {
    const podSpec = renderDeployment(spec()).spec?.template.spec;
    expect(podSpec?.enableServiceLinks).toBe(false);
  });

  it('omits imagePullSecrets for a public image (no imagePullCredentials)', () => {
    const podSpec = renderDeployment(spec()).spec?.template.spec;
    expect(podSpec?.imagePullSecrets).toBeUndefined();
  });

  it('references the image pull secret by name when imagePullCredentials is set', () => {
    const podSpec = renderDeployment(
      spec({
        imagePullCredentials: {
          registry: 'registry.example.com',
          username: 'robot$pull',
          password: 'p@ss',
        },
      }),
    ).spec?.template.spec;
    expect(podSpec?.imagePullSecrets).toEqual([{ name: IMAGE_PULL_SECRET_NAME }]);
  });

  it('boots via the uvicorn factory that serves the prebuilt frontend, not the image default CMD', () => {
    const container = renderDeployment(spec()).spec?.template.spec?.containers[0];
    expect(container?.command).toEqual([
      'uv',
      'run',
      'uvicorn',
      '--factory',
      'riogentix.main:setup_app',
      '--host',
      '0.0.0.0',
      '--port',
      '8000',
      '--loop',
      'asyncio',
    ]);
  });
});

describe('renderService', () => {
  it('selects the deployment pods for this tenant only', () => {
    const service = renderService(spec());
    expect(service.metadata?.name).toBe(SERVICE_NAME);
    expect(service.spec?.selector).toEqual({
      'app.kubernetes.io/name': 'riogentix',
      'saas.platform/tenant-slug': 'acme-co',
    });
  });
});

describe('renderIngress', () => {
  it('routes the tenant host and the app.{host} host to the service with no TLS block by default', () => {
    const ingress = renderIngress(spec());
    const rules = ingress.spec?.rules ?? [];
    expect(rules.map((r) => r.host)).toEqual(['acme-co.example.com', 'app.acme-co.example.com']);
    for (const rule of rules) {
      expect(rule.http?.paths[0]?.backend.service?.name).toBe(SERVICE_NAME);
    }
    expect(ingress.spec?.ingressClassName).toBe('nginx');
    // wildcard cert at the controller — the ingress itself carries no TLS
    expect(ingress.spec?.tls).toBeUndefined();
    expect(ingress.metadata?.annotations).toBeUndefined();
  });

  it('adds cert-manager annotation + TLS block covering both hosts when an issuer is configured', () => {
    const ingress = renderIngress(spec({ certManagerIssuer: 'letsencrypt-prod' }));
    expect(ingress.metadata?.annotations).toEqual({
      'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
    });
    expect(ingress.spec?.tls?.[0]?.hosts).toEqual([
      'acme-co.example.com',
      'app.acme-co.example.com',
    ]);
  });
});

describe('object naming', () => {
  it('uses fixed names inside the per-tenant namespace', () => {
    // Names are constant because the namespace is the per-tenant scope —
    // internal URLs like http://riogentix.t-<slug>.svc.cluster.local rely on it.
    expect(DEPLOYMENT_NAME).toBe('riogentix');
    expect(SERVICE_NAME).toBe('riogentix');
  });
});
