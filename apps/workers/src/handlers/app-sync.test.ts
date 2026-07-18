import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockOutboxFindMany,
  mockOutboxUpdateMany,
  mockInstanceFindMany,
  mockInstanceUpdate,
  mockConverge,
} = vi.hoisted(() => ({
  mockOutboxFindMany: vi.fn(),
  mockOutboxUpdateMany: vi.fn(),
  mockInstanceFindMany: vi.fn(),
  mockInstanceUpdate: vi.fn(),
  mockConverge: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    syncOutboxEvent: { findMany: mockOutboxFindMany, updateMany: mockOutboxUpdateMany },
    connectedAppInstance: { findMany: mockInstanceFindMany, update: mockInstanceUpdate },
  },
}));

vi.mock('@platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./app-sync-targets.js', () => ({
  convergeAppInstance: mockConverge,
}));

import { handleAppSync } from './app-sync.js';

const TENANT_ID = 'tenant-1';

function job(): Job<{ tenantId: string }> {
  return { id: 'job-1', data: { tenantId: TENANT_ID } } as unknown as Job<{ tenantId: string }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOutboxUpdateMany.mockResolvedValue({ count: 0 });
  mockInstanceUpdate.mockResolvedValue({});
});

describe('handleAppSync', () => {
  it('does nothing when there are no pending events', async () => {
    mockOutboxFindMany.mockResolvedValue([]);

    await handleAppSync(job());

    expect(mockOutboxUpdateMany).not.toHaveBeenCalled();
    expect(mockInstanceFindMany).not.toHaveBeenCalled();
  });

  it('marks events DONE when the tenant has no registered app instances', async () => {
    mockOutboxFindMany.mockResolvedValue([{ id: 1n }, { id: 2n }]);
    mockInstanceFindMany.mockResolvedValue([]);

    await handleAppSync(job());

    // Claimed as PROCESSING first, then marked DONE.
    expect(mockOutboxUpdateMany).toHaveBeenCalledTimes(2);
    const doneCall = mockOutboxUpdateMany.mock.calls[1]?.[0] as {
      where: { id: { in: bigint[] } };
      data: { status: string };
    };
    expect(doneCall.data.status).toBe('DONE');
    expect(doneCall.where.id.in).toEqual([1n, 2n]);
  });

  it('converges each active instance and records the sync time', async () => {
    const instance = {
      id: 'inst-1',
      tenantId: TENANT_ID,
      app: { slug: 'riogentix' },
    };
    mockOutboxFindMany.mockResolvedValue([{ id: 3n }]);
    mockInstanceFindMany.mockResolvedValue([instance]);
    mockConverge.mockResolvedValue(undefined);

    await handleAppSync(job());

    expect(mockConverge).toHaveBeenCalledWith(instance);
    expect(mockInstanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inst-1' } }),
    );
  });

  it('marks events FAILED and rethrows when convergence fails', async () => {
    mockOutboxFindMany.mockResolvedValue([{ id: 4n }]);
    mockInstanceFindMany.mockResolvedValue([
      { id: 'inst-1', tenantId: TENANT_ID, app: { slug: 'riogentix' } },
    ]);
    mockConverge.mockRejectedValue(new Error('SCIM endpoint unreachable'));

    await expect(handleAppSync(job())).rejects.toThrow('SCIM endpoint unreachable');

    const failedCall = mockOutboxUpdateMany.mock.calls[1]?.[0] as {
      data: { status: string; lastError: string };
    };
    expect(failedCall.data.status).toBe('FAILED');
    expect(failedCall.data.lastError).toContain('SCIM endpoint unreachable');
  });

  it('re-claims previously FAILED events alongside new ones', async () => {
    mockOutboxFindMany.mockResolvedValue([{ id: 5n }]);
    mockInstanceFindMany.mockResolvedValue([]);

    await handleAppSync(job());

    const claimQuery = mockOutboxFindMany.mock.calls[0]?.[0] as {
      where: { status: { in: string[] } };
    };
    expect(claimQuery.where.status.in).toEqual(expect.arrayContaining(['PENDING', 'FAILED']));
  });
});
