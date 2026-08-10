import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantFindMany, mockOutboxCreate, mockEnqueue } = vi.hoisted(() => ({
  mockTenantFindMany: vi.fn(),
  mockOutboxCreate: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenant: { findMany: mockTenantFindMany },
    syncOutboxEvent: { create: mockOutboxCreate },
  },
}));

vi.mock('@platform/jobs', () => ({
  appSyncQueue: {},
  enqueue: mockEnqueue,
}));

vi.mock('@platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleAppSyncReconcile } from './app-sync-reconcile.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockOutboxCreate.mockResolvedValue({});
  mockEnqueue.mockResolvedValue('job-id');
});

describe('handleAppSyncReconcile', () => {
  it('does nothing when no tenant has an active connected app instance', async () => {
    mockTenantFindMany.mockResolvedValue([]);

    await handleAppSyncReconcile();

    expect(mockOutboxCreate).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('only queries ACTIVE tenants with an ACTIVE connected app instance', async () => {
    mockTenantFindMany.mockResolvedValue([]);

    await handleAppSyncReconcile();

    expect(mockTenantFindMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', connectedAppInstances: { some: { status: 'ACTIVE' } } },
      select: { id: true },
    });
  });

  it('writes an outbox event and enqueues app-sync for every matching tenant', async () => {
    mockTenantFindMany.mockResolvedValue([{ id: 'tenant-demo' }, { id: 'tenant-globex' }]);

    await handleAppSyncReconcile();

    expect(mockOutboxCreate).toHaveBeenCalledTimes(2);
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-demo', resourceType: 'TENANT' }),
      }),
    );
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledWith(expect.anything(), { tenantId: 'tenant-demo' });
    expect(mockEnqueue).toHaveBeenCalledWith(expect.anything(), { tenantId: 'tenant-globex' });
  });
});
