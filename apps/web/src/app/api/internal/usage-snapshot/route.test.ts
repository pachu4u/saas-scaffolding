import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantFindUnique, mockUpsert, mockExecuteRaw } = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenant: { findUnique: mockTenantFindUnique },
    usageSnapshot: { upsert: mockUpsert },
    $executeRaw: mockExecuteRaw,
  },
}));

import { POST } from './route';

const SECRET = 'test-internal-secret';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function makeRequest(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/internal/usage-snapshot', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-internal-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_SNAPSHOT = { flows: 3, storage_bytes: 12345, api_keys: 2, seats: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PLATFORM_INTERNAL_SECRET = SECRET;
  mockTenantFindUnique.mockResolvedValue({ id: TENANT_ID });
  mockUpsert.mockResolvedValue({});
  mockExecuteRaw.mockResolvedValue([]);
});

describe('POST /api/internal/usage-snapshot', () => {
  it('returns 401 without the internal secret', async () => {
    const res = await POST(makeRequest({ slug: 'acme', snapshot: VALID_SNAPSHOT }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 with a wrong secret', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: VALID_SNAPSHOT }, 'wrong') as never,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when slug is missing', async () => {
    const res = await POST(makeRequest({ snapshot: VALID_SNAPSHOT }, SECRET) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed snapshot (not an object)', async () => {
    const res = await POST(makeRequest({ slug: 'acme', snapshot: 'nope' }, SECRET) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty snapshot', async () => {
    const res = await POST(makeRequest({ slug: 'acme', snapshot: {} }, SECRET) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown kind', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: { ...VALID_SNAPSHOT, bogus: 1 } }, SECRET) as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for a negative value', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: { ...VALID_SNAPSHOT, flows: -1 } }, SECRET) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-integer value', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: { ...VALID_SNAPSHOT, flows: 1.5 } }, SECRET) as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown tenant slug', async () => {
    mockTenantFindUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ slug: 'ghost', snapshot: VALID_SNAPSHOT }, SECRET) as never,
    );
    expect(res.status).toBe(404);
  });

  it('upserts all four kinds and returns 201', async () => {
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: VALID_SNAPSHOT }, SECRET) as never,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { upserted: number };
    expect(body.upserted).toBe(4);

    expect(mockTenantFindUnique).toHaveBeenCalledWith({
      where: { slug: 'acme' },
      select: { id: true },
    });
    expect(mockUpsert).toHaveBeenCalledTimes(4);
    // NOTIFY fired
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('upsert overwrites, never appends: second POST wins', async () => {
    // First sync
    await POST(makeRequest({ slug: 'acme', snapshot: VALID_SNAPSHOT }, SECRET) as never);
    // Second sync with a LOWER flows value — must overwrite, not sum.
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: { ...VALID_SNAPSHOT, flows: 1 } }, SECRET) as never,
    );
    expect(res.status).toBe(201);

    const flowsCalls = mockUpsert.mock.calls.filter(
      (c) =>
        (c[0] as { where: { tenantId_kind: { kind: string } } }).where.tenantId_kind.kind ===
        'flows',
    );
    expect(flowsCalls).toHaveLength(2);
    const second = flowsCalls[1]?.[0] as {
      where: { tenantId_kind: { tenantId: string; kind: string } };
      create: { value: number };
      update: { value: number };
    };
    // Absolute overwrite semantics: the value is the second payload's 1,
    // never 3 + 1.
    expect(second.create.value).toBe(1);
    expect(second.update.value).toBe(1);
    expect(second.where.tenantId_kind).toEqual({ tenantId: TENANT_ID, kind: 'flows' });
  });

  it('still returns 201 when pg_notify fails', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('notify boom'));
    const res = await POST(
      makeRequest({ slug: 'acme', snapshot: VALID_SNAPSHOT }, SECRET) as never,
    );
    expect(res.status).toBe(201);
  });
});
