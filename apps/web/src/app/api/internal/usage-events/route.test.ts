import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantFindUnique, mockCreateMany, mockQueryRaw } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockCreateMany: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenant: { findUnique: mockTenantFindUnique },
    usageEvent: { createMany: mockCreateMany },
    $queryRaw: mockQueryRaw,
  },
}));

import { POST } from './route';

const SECRET = 'test-internal-secret';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function makeRequest(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/internal/usage-events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-internal-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PLATFORM_INTERNAL_SECRET = SECRET;
  mockTenantFindUnique.mockResolvedValue({ id: TENANT_ID });
  mockCreateMany.mockResolvedValue({ count: 1 });
  mockQueryRaw.mockResolvedValue([]);
});

describe('POST /api/internal/usage-events', () => {
  it('returns 401 without the internal secret', async () => {
    const res = await POST(makeRequest({ slug: 'acme', kind: 'flow.executed' }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 with a wrong secret', async () => {
    const res = await POST(makeRequest({ slug: 'acme', kind: 'flow.executed' }, 'wrong') as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an unknown kind', async () => {
    const res = await POST(makeRequest({ slug: 'acme', kind: 'nope' }, SECRET) as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when neither tenantId nor slug is provided', async () => {
    const res = await POST(makeRequest({ kind: 'flow.executed' }, SECRET) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid quantity', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', kind: 'flow.executed', quantity: -3 }, SECRET) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid occurredAt', async () => {
    const res = await POST(
      makeRequest(
        { slug: 'acme', kind: 'flow.executed', occurredAt: 'not-a-date' },
        SECRET,
      ) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown tenant slug', async () => {
    mockTenantFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ slug: 'ghost', kind: 'flow.executed' }, SECRET) as never);
    expect(res.status).toBe(404);
  });

  it('inserts a single event and returns 201', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', kind: 'flow.executed', quantity: 3 }, SECRET) as never,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inserted: number };
    expect(body.inserted).toBe(1);

    expect(mockTenantFindUnique).toHaveBeenCalledWith({
      where: { slug: 'acme' },
      select: { id: true },
    });
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
    const callArg = mockCreateMany.mock.calls[0]?.[0] as {
      data: { tenantId: string; kind: string; quantity: number; occurredAt: Date }[];
    };
    const data = callArg.data;
    expect(data).toHaveLength(1);
    expect(data[0]?.tenantId).toBe(TENANT_ID);
    expect(data[0]?.kind).toBe('flow.executed');
    expect(data[0]?.quantity).toBe(3);
    // NOTIFY fired
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('resolves a tenant by tenantId', async () => {
    const res = await POST(
      makeRequest({ tenantId: TENANT_ID, kind: 'seat.added' }, SECRET) as never,
    );
    expect(res.status).toBe(201);
    expect(mockTenantFindUnique).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      select: { id: true },
    });
  });

  it('inserts a batch of events', async () => {
    mockCreateMany.mockResolvedValue({ count: 3 });
    const res = await POST(
      makeRequest(
        {
          slug: 'acme',
          events: [
            { kind: 'flow.executed' },
            { kind: 'flow.created', quantity: 2 },
            { kind: 'storage.updated', quantity: 10, occurredAt: '2026-08-01T12:00:00Z' },
          ],
        },
        SECRET,
      ) as never,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { inserted: number };
    expect(body.inserted).toBe(3);
    const callArg = mockCreateMany.mock.calls[0]?.[0] as { data: unknown[] };
    expect(callArg.data).toHaveLength(3);
  });

  it('rejects a batch with one invalid event', async () => {
    const res = await POST(
      makeRequest(
        { slug: 'acme', events: [{ kind: 'flow.executed' }, { kind: 'bogus' }] },
        SECRET,
      ) as never,
    );
    expect(res.status).toBe(400);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('rejects an empty batch', async () => {
    const res = await POST(makeRequest({ slug: 'acme', events: [] }, SECRET) as never);
    expect(res.status).toBe(400);
  });

  it('still returns 201 when pg_notify fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('notify boom'));
    const res = await POST(makeRequest({ slug: 'acme', kind: 'flow.executed' }, SECRET) as never);
    expect(res.status).toBe(201);
  });
});
