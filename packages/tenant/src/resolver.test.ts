import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedisGet, mockRedisSetex, mockRedisDel, mockTenantFindUnique } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSetex: vi.fn(),
  mockRedisDel: vi.fn(),
  mockTenantFindUnique: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: { tenant: { findUnique: mockTenantFindUnique } },
  redis: { get: mockRedisGet, setex: mockRedisSetex, del: mockRedisDel },
}));

import { extractSlug, resolveTenant, invalidateTenantCache } from './resolver.js';

describe('extractSlug', () => {
  it('extracts the leftmost label from a tenant subdomain', () => {
    expect(extractSlug('acme.lvh.me')).toBe('acme');
  });

  it('is case-insensitive', () => {
    expect(extractSlug('Acme.lvh.me')).toBe('acme');
  });

  it('strips a port suffix that is part of the last label, not the slug', () => {
    expect(extractSlug('acme.lvh.me:3000')).toBe('acme');
  });

  it('returns null for reserved subdomains', () => {
    for (const reserved of ['app', 'auth', 'api', 'admin', 'www', 'traefik', 'grafana']) {
      expect(extractSlug(`${reserved}.lvh.me`)).toBeNull();
    }
  });

  it('returns null for a bare host with no subdomain (e.g. localhost)', () => {
    expect(extractSlug('localhost:3000')).toBeNull();
  });

  it('returns null for slugs containing invalid characters', () => {
    expect(extractSlug('ac me.lvh.me')).toBeNull();
    expect(extractSlug('acme_corp.lvh.me')).toBeNull();
  });

  it('returns null for an empty host', () => {
    expect(extractSlug('')).toBeNull();
  });

  it('accepts hyphenated slugs', () => {
    expect(extractSlug('acme-corp.lvh.me')).toBe('acme-corp');
  });
});

describe('resolveTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the cached value without hitting the database on a cache hit', async () => {
    const cached = {
      tenantId: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'pro',
      status: 'ACTIVE',
      branding: {},
    };
    mockRedisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await resolveTenant('acme');

    expect(result).toEqual(cached);
    expect(mockTenantFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to the database on a cache miss and populates the cache', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockTenantFindUnique.mockResolvedValue({
      id: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'pro',
      status: 'ACTIVE',
      branding: { primaryColor: '#000' },
    });

    const result = await resolveTenant('acme');

    expect(result).toEqual({
      tenantId: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'pro',
      status: 'ACTIVE',
      branding: { primaryColor: '#000' },
    });
    expect(mockRedisSetex).toHaveBeenCalledWith(
      'tenant:slug:acme',
      60,
      expect.stringContaining('"tenantId":"t1"'),
    );
  });

  it('returns null when the tenant does not exist', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockTenantFindUnique.mockResolvedValue(null);

    expect(await resolveTenant('nonexistent')).toBeNull();
  });

  it('returns null for a soft-deleted tenant even though the row still exists', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockTenantFindUnique.mockResolvedValue({
      id: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'pro',
      status: 'DELETED',
      branding: {},
    });

    expect(await resolveTenant('acme')).toBeNull();
  });

  it('falls through to the database when Redis is unavailable', async () => {
    mockRedisGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockTenantFindUnique.mockResolvedValue({
      id: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'free',
      status: 'ACTIVE',
      branding: {},
    });

    const result = await resolveTenant('acme');

    expect(result?.tenantId).toBe('t1');
  });

  it('still returns the resolved tenant even if writing the cache fails', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockRejectedValue(new Error('Redis write failed'));
    mockTenantFindUnique.mockResolvedValue({
      id: 't1',
      slug: 'acme',
      name: 'Acme',
      plan: 'free',
      status: 'ACTIVE',
      branding: {},
    });

    const result = await resolveTenant('acme');

    expect(result?.tenantId).toBe('t1');
  });
});

describe('invalidateTenantCache', () => {
  it('deletes the correctly namespaced cache key for the slug', async () => {
    mockRedisDel.mockResolvedValue(1);

    await invalidateTenantCache('acme');

    expect(mockRedisDel).toHaveBeenCalledWith('tenant:slug:acme');
  });
});
