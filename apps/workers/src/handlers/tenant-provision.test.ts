import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTenantFindUnique,
  mockTenantUpdate,
  mockEnvUpsert,
  mockEnvUpdate,
  mockEnvUpdateMany,
  mockProvision,
  mockDeprovision,
} = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockTenantUpdate: vi.fn(),
  mockEnvUpsert: vi.fn(),
  mockEnvUpdate: vi.fn(),
  mockEnvUpdateMany: vi.fn(),
  mockProvision: vi.fn(),
  mockDeprovision: vi.fn(),
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
  },
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
});

describe('handleTenantProvision', () => {
  it('walks IN_PROGRESS → COMPLETED and activates environments with the driver URL', async () => {
    mockProvision.mockResolvedValue({ publicUrl: 'https://acme.tenants.example.com' });

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
    mockProvision.mockResolvedValue({ publicUrl: null });

    await handleTenantProvision(job({ tenantId: 'tenant-1', environments: ['PROD'] }) as never);

    expect(mockEnvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', endpoint: 'https://acme.example.com' },
      }),
    );
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
  it('tears down the stack and resets tenant + environments to PENDING', async () => {
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
  });

  it('does not touch the driver when the tenant is gone', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    await handleTenantDeprovision(job({ tenantId: 'gone' }) as never);

    expect(mockDeprovision).not.toHaveBeenCalled();
  });
});
