import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockScimTokenFindFirst, mockScimTokenUpdate, mockTenantFindUnique } = vi.hoisted(() => ({
  mockScimTokenFindFirst: vi.fn(),
  mockScimTokenUpdate: vi.fn(),
  mockTenantFindUnique: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    scimToken: { findFirst: mockScimTokenFindFirst, update: mockScimTokenUpdate },
    tenant: { findUnique: mockTenantFindUnique },
  },
}));

import { authenticateScim, hashToken } from './auth.js';

function makeRequest(headers: Record<string, string>): Request {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Request;
}

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });

  it('never returns the raw token back', () => {
    expect(hashToken('my-secret-token')).not.toContain('my-secret-token');
  });
});

describe('authenticateScim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScimTokenUpdate.mockResolvedValue({});
  });

  it('rejects requests with no Authorization header', async () => {
    const req = makeRequest({});
    expect(await authenticateScim(req as never)).toBeNull();
    expect(mockScimTokenFindFirst).not.toHaveBeenCalled();
  });

  it('rejects non-Bearer Authorization headers', async () => {
    const req = makeRequest({ authorization: 'Basic abc123' });
    expect(await authenticateScim(req as never)).toBeNull();
  });

  it('rejects an unknown token', async () => {
    mockScimTokenFindFirst.mockResolvedValue(null);
    const req = makeRequest({ authorization: 'Bearer scim_unknown', 'x-tenant-slug': 'acme' });

    expect(await authenticateScim(req as never)).toBeNull();
  });

  it("rejects when the request's tenant slug doesn't match the token's tenant", async () => {
    mockScimTokenFindFirst.mockResolvedValue({ id: 'tok1', tenantId: 't1', scopes: ['read'] });
    mockTenantFindUnique.mockResolvedValue({ slug: 'acme' });
    const req = makeRequest({ authorization: 'Bearer scim_valid', 'x-tenant-slug': 'globex' });

    expect(await authenticateScim(req as never)).toBeNull();
  });

  it('authenticates a valid token whose tenant slug matches the request host', async () => {
    mockScimTokenFindFirst.mockResolvedValue({
      id: 'tok1',
      tenantId: 't1',
      scopes: ['read', 'write'],
    });
    mockTenantFindUnique.mockResolvedValue({ slug: 'acme' });
    const req = makeRequest({ authorization: 'Bearer scim_valid', 'x-tenant-slug': 'acme' });

    const ctx = await authenticateScim(req as never);

    expect(ctx).toEqual({ tokenId: 'tok1', tenantId: 't1', scopes: ['read', 'write'] });
  });

  it('looks up the token by its hash, never the raw value', async () => {
    mockScimTokenFindFirst.mockResolvedValue(null);
    const req = makeRequest({ authorization: 'Bearer my-raw-token', 'x-tenant-slug': 'acme' });

    await authenticateScim(req as never);

    const callArg = mockScimTokenFindFirst.mock.calls[0]?.[0] as {
      where: { hashedToken: string };
    };
    expect(callArg.where.hashedToken).toBe(hashToken('my-raw-token'));
    expect(callArg.where.hashedToken).not.toBe('my-raw-token');
  });

  it('updates lastUsedAt on successful authentication (fire-and-forget)', async () => {
    mockScimTokenFindFirst.mockResolvedValue({ id: 'tok1', tenantId: 't1', scopes: [] });
    mockTenantFindUnique.mockResolvedValue({ slug: 'acme' });
    const req = makeRequest({ authorization: 'Bearer scim_valid', 'x-tenant-slug': 'acme' });

    await authenticateScim(req as never);

    expect(mockScimTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tok1' } }),
    );
  });
});
