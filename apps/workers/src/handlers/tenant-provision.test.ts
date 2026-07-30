import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTenantFindUnique,
  mockTenantUpdate,
  mockEnvUpsert,
  mockEnvUpdate,
  mockEnvUpdateMany,
  mockConnectedAppUpsert,
  mockConnectedAppInstanceUpsert,
  mockConnectedAppInstanceUpdateMany,
  mockRoleBindingFindFirst,
  mockSyncOutboxEventCreate,
  mockEnqueue,
  mockProvision,
  mockDeprovision,
  mockBootstrapTenantAdmin,
} = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockTenantUpdate: vi.fn(),
  mockEnvUpsert: vi.fn(),
  mockEnvUpdate: vi.fn(),
  mockEnvUpdateMany: vi.fn(),
  mockConnectedAppUpsert: vi.fn(),
  mockConnectedAppInstanceUpsert: vi.fn(),
  mockConnectedAppInstanceUpdateMany: vi.fn(),
  mockRoleBindingFindFirst: vi.fn(),
  mockSyncOutboxEventCreate: vi.fn(),
  mockEnqueue: vi.fn(),
  mockProvision: vi.fn(),
  mockDeprovision: vi.fn(),
  mockBootstrapTenantAdmin: vi.fn(),
}));

vi.mock('@platform/config', () => ({
  env: { AUTH_URL: 'https://saas.example.com' },
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenant: { findUnique: mockTenantFindUnique, update: mockTenantUpdate },
    tenantEnvironment: {
      upsert: mockEnvUpsert,
      update: mockEnvUpdate,
      updateMany: mockEnvUpdateMany,
    },
    connectedApp: { upsert: mockConnectedAppUpsert },
    connectedAppInstance: {
      upsert: mockConnectedAppInstanceUpsert,
      updateMany: mockConnectedAppInstanceUpdateMany,
    },
    roleBinding: { findFirst: mockRoleBindingFindFirst },
    syncOutboxEvent: { create: mockSyncOutboxEventCreate },
  },
  withLock: async (_key: string, _ttlMs: number, fn: () => Promise<unknown>) => ({
    acquired: true,
    value: await fn(),
  }),
}));

vi.mock('@platform/jobs', () => ({
  appSyncQueue: {},
  enqueue: mockEnqueue,
}));

vi.mock('@platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../provisioning/index.js', () => ({
  getTenantStackDriver: () => ({
    name: 'kubernetes',
    provision: mockProvision,
    deprovision: mockDeprovision,
  }),
}));

vi.mock('./riogentix-client.js', () => ({
  bootstrapTenantAdmin: mockBootstrapTenantAdmin,
}));

import { handleTenantDeprovision, handleTenantProvision } from './tenant-provision.js';

const TENANT = { id: 'tenant-1', slug: 'acme', plan: 'pro' };

function job(data: unknown): Job<never> {
  return { id: 'job-1', data } as unknown as Job<never>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantFindUnique.mockResolvedValue(TENANT);
  mockTenantUpdate.mockResolvedValue({});
  mockEnvUpsert.mockResolvedValue({});
  mockEnvUpdate.mockResolvedValue({});
  mockEnvUpdateMany.mockResolvedValue({ count: 1 });
  mockConnectedAppUpsert.mockResolvedValue({ id: 'app-uuid-riogentix' });
  mockConnectedAppInstanceUpsert.mockResolvedValue({});
  mockConnectedAppInstanceUpdateMany.mockResolvedValue({ count: 1 });
  mockRoleBindingFindFirst.mockResolvedValue(null);
  mockBootstrapTenantAdmin.mockResolvedValue(null);
});

describe('handleTenantProvision', () => {
  it('walks IN_PROGRESS → COMPLETED and activates environments with the driver URL', async () => {
    mockProvision.mockResolvedValue({
      publicUrl: 'https://acme.tenants.example.com',
      scimEndpoint: null,
    });

    await handleTenantProvision(
      job({ tenantId: 'tenant-1', environments: ['PROD', 'DEV'] }) as never,
    );

    // first transition: IN_PROGRESS with error cleared
    expect(mockTenantUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'tenant-1' },
        data: { provisioningStatus: 'IN_PROGRESS', provisioningError: null },
      }),
    );
    // environments marked PROVISIONING (upsert covers the signup path where rows don't exist)
    expect(mockEnvUpsert).toHaveBeenCalledTimes(2);

    expect(mockProvision).toHaveBeenCalledWith(TENANT);

    // PROD gets the bare URL, non-PROD gets the env suffix
    const endpoints = (mockEnvUpdate.mock.calls as [{ data: { endpoint: string } }][]).map(
      (c) => c[0].data.endpoint,
    );
    expect(endpoints).toContain('https://acme.tenants.example.com');
    expect(endpoints).toContain('https://acme.tenants.example.com?env=dev');

    // final transition: COMPLETED
    expect(mockTenantUpdate.mock.calls.at(-1)?.[0]).toMatchObject({
      data: { provisioningStatus: 'COMPLETED', provisioningError: null },
    });
  });

  it('falls back to the platform wildcard URL when the driver returns none (shared topology)', async () => {
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint: null });

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockEnvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', endpoint: 'https://acme.example.com' },
      }),
    );
  });

  it('upserts a ConnectedAppInstance when the driver returns a scimEndpoint', async () => {
    const scimEndpoint = {
      baseUrl: 'http://riogentix.internal/api/v1/scim/v2/tenants/tenant-1',
      token: 'secret-token',
    };
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint });

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockConnectedAppUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'riogentix' },
        create: { slug: 'riogentix', name: 'Riogentix' },
      }),
    );
    expect(mockConnectedAppInstanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appId_tenantId: { appId: 'app-uuid-riogentix', tenantId: 'tenant-1' } },
        create: expect.objectContaining({
          scimBaseUrl: scimEndpoint.baseUrl,
          scimToken: scimEndpoint.token,
        }) as unknown,
        update: expect.objectContaining({
          scimBaseUrl: scimEndpoint.baseUrl,
          scimToken: scimEndpoint.token,
          status: 'ACTIVE',
        }) as unknown,
      }),
    );
    expect(mockSyncOutboxEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', resourceType: 'TENANT' }) as unknown,
      }),
    );
    expect(mockEnqueue).toHaveBeenCalledWith({}, { tenantId: 'tenant-1' });
  });

  it('bootstraps the riogentix admin role for the holder of the tenant_admin binding', async () => {
    const scimEndpoint = {
      baseUrl: 'http://riogentix.internal/api/v1/scim/v2/tenants/tenant-1',
      token: 'secret-token',
    };
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint });
    mockRoleBindingFindFirst.mockResolvedValue({
      user: { id: 'user-1', email: 'founder@acme.com' },
    });
    mockBootstrapTenantAdmin.mockResolvedValue({
      userId: 'riogentix-user-1',
      roleId: 'riogentix-role-admin',
      assignmentId: 'riogentix-assignment-1',
    });

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockRoleBindingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', role: { appId: null, name: 'tenant_admin' } },
      }),
    );
    expect(mockBootstrapTenantAdmin).toHaveBeenCalledWith(
      'tenant-1',
      'founder@acme.com',
      'founder',
      'admin',
    );
  });

  it('skips riogentix admin bootstrap when the tenant has no tenant_admin binding yet', async () => {
    const scimEndpoint = {
      baseUrl: 'http://riogentix.internal/api/v1/scim/v2/tenants/tenant-1',
      token: 'secret-token',
    };
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint });
    mockRoleBindingFindFirst.mockResolvedValue(null);

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockBootstrapTenantAdmin).not.toHaveBeenCalled();
    // Convergence still gets enqueued — bootstrap is best-effort on top of it.
    expect(mockEnqueue).toHaveBeenCalledWith({}, { tenantId: 'tenant-1' });
  });

  it('fails the provision (and lets BullMQ retry) when riogentix admin bootstrap throws', async () => {
    const scimEndpoint = {
      baseUrl: 'http://riogentix.internal/api/v1/scim/v2/tenants/tenant-1',
      token: 'secret-token',
    };
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint });
    mockRoleBindingFindFirst.mockResolvedValue({
      user: { id: 'user-1', email: 'founder@acme.com' },
    });
    mockBootstrapTenantAdmin.mockRejectedValue(new Error('riogentix unreachable'));

    await expect(
      handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never),
    ).rejects.toThrow('riogentix unreachable');

    expect(mockTenantUpdate.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        provisioningStatus: 'FAILED',
        provisioningError: expect.stringContaining('riogentix unreachable') as string,
      },
    });
    // Never reached — bootstrap failure short-circuits before convergence enqueue.
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('skips ConnectedAppInstance upsert when scimEndpoint is null', async () => {
    mockProvision.mockResolvedValue({ publicUrl: null, scimEndpoint: null });

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockConnectedAppUpsert).not.toHaveBeenCalled();
    expect(mockConnectedAppInstanceUpsert).not.toHaveBeenCalled();
  });

  it('marks tenant + environments FAILED and rethrows so BullMQ retries', async () => {
    mockProvision.mockRejectedValue(new Error('cluster unreachable'));

    await expect(
      handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never),
    ).rejects.toThrow('cluster unreachable');

    expect(mockTenantUpdate.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        provisioningStatus: 'FAILED',
        provisioningError: expect.stringContaining('cluster unreachable') as string,
      },
    });
    expect(mockEnvUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', type: { in: ['PROD'] } },
      data: { status: 'FAILED' },
    });
  });

  it('skips silently when the tenant was deleted after enqueue', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    await handleTenantProvision(job({ tenantId: 'gone', environments: ['PROD'] }) as never);

    expect(mockProvision).not.toHaveBeenCalled();
    expect(mockTenantUpdate).not.toHaveBeenCalled();
  });
});

describe('handleTenantDeprovision', () => {
  it('tears down the stack, resets tenant + environments to PENDING, and pauses app instances', async () => {
    await handleTenantDeprovision(job({ tenantId: 'tenant-1' }) as never);

    expect(mockDeprovision).toHaveBeenCalledWith({ id: 'tenant-1', slug: 'acme' });
    expect(mockEnvUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { status: 'PENDING', endpoint: null },
    });
    expect(mockTenantUpdate).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { provisioningStatus: 'PENDING', provisioningError: null },
    });
    expect(mockConnectedAppInstanceUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { status: 'PAUSED' },
    });
  });

  it('does not touch the driver when the tenant is gone', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    await handleTenantDeprovision(job({ tenantId: 'gone' }) as never);

    expect(mockDeprovision).not.toHaveBeenCalled();
  });
});
