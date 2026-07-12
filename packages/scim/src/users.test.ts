import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockExternalIdentityFindUnique,
  mockExternalIdentityUpsert,
  mockUserUpsert,
  mockTenantUserUpsert,
  mockTenantUserDelete,
  mockWithTenant,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockExternalIdentityFindUnique: vi.fn(),
  mockExternalIdentityUpsert: vi.fn(),
  mockUserUpsert: vi.fn(),
  mockTenantUserUpsert: vi.fn(),
  mockTenantUserDelete: vi.fn(),
  mockWithTenant: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    externalIdentity: {
      findUnique: mockExternalIdentityFindUnique,
      upsert: mockExternalIdentityUpsert,
    },
    user: { upsert: mockUserUpsert },
    tenantUser: { upsert: mockTenantUserUpsert, delete: mockTenantUserDelete },
  },
  withTenant: mockWithTenant,
}));

vi.mock('@platform/logger/audit', () => ({
  auditLog: mockAuditLog,
}));

import { toScimUser, scimCreateUser, scimDeleteUser } from './users.js';

const TENANT_ID = 'tenant-1';

describe('toScimUser', () => {
  it('maps a DB user record to the SCIM User schema', () => {
    const user = {
      id: 'u1',
      externalId: 'okta-123',
      email: 'alice@acme.test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    };

    const scim = toScimUser(user, 'https://acme.lvh.me');

    expect(scim.id).toBe('u1');
    expect(scim.externalId).toBe('okta-123');
    expect(scim.userName).toBe('alice@acme.test');
    expect(scim.emails?.[0]).toEqual({ value: 'alice@acme.test', primary: true, type: 'work' });
    expect(scim.active).toBe(true);
    expect(scim.meta.location).toBe('https://acme.lvh.me/scim/v2/Users/u1');
    expect(scim.meta.created).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('scimCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
    mockTenantUserUpsert.mockResolvedValue({});
    mockExternalIdentityUpsert.mockResolvedValue({});
  });

  it('creates a new user and links it to the tenant', async () => {
    mockExternalIdentityFindUnique.mockResolvedValue(null);
    mockUserUpsert.mockResolvedValue({ id: 'u1', email: 'bob@acme.test' });

    const user = await scimCreateUser(TENANT_ID, {
      userName: 'Bob@Acme.test',
      externalId: 'okta-1',
    });

    expect(user).toEqual({ id: 'u1', email: 'bob@acme.test' });
    // userName is lowercased before lookup/create
    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'bob@acme.test' } }),
    );
    expect(mockTenantUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { tenantId: TENANT_ID, userId: 'u1', status: 'ACTIVE' },
      }),
    );
    expect(mockExternalIdentityUpsert).toHaveBeenCalled();
  });

  it('is idempotent — returns the existing user when externalId is already provisioned', async () => {
    mockExternalIdentityFindUnique.mockResolvedValue({
      user: { id: 'existing-u1', email: 'bob@acme.test' },
    });

    const user = await scimCreateUser(TENANT_ID, {
      userName: 'bob@acme.test',
      externalId: 'okta-1',
    });

    expect(user).toEqual({ id: 'existing-u1', email: 'bob@acme.test' });
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });

  it('records an audit log entry on creation', async () => {
    mockExternalIdentityFindUnique.mockResolvedValue(null);
    mockUserUpsert.mockResolvedValue({ id: 'u1', email: 'bob@acme.test' });

    await scimCreateUser(TENANT_ID, { userName: 'bob@acme.test' }, 'actor-1');

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorUserId: 'actor-1',
        action: 'scim.user.create',
        resourceId: 'u1',
      }),
    );
  });
});

describe('scimDeleteUser', () => {
  it('removes the tenant membership and records an audit entry', async () => {
    mockWithTenant.mockImplementation((_tenantId: string, fn: (tx: unknown) => unknown) =>
      fn({ tenantUser: { delete: mockTenantUserDelete } }),
    );
    mockTenantUserDelete.mockResolvedValue({});
    mockAuditLog.mockResolvedValue(undefined);

    await scimDeleteUser(TENANT_ID, 'u1', 'actor-1');

    expect(mockTenantUserDelete).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: TENANT_ID, userId: 'u1' } },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'scim.user.delete', resourceId: 'u1' }),
    );
  });
});
