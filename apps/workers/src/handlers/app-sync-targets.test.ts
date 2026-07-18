import { SCIM_ROLE_EXTENSION } from '@platform/scim';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTenantUserFindMany, mockRoleBindingFindMany } = vi.hoisted(() => ({
  mockTenantUserFindMany: vi.fn(),
  mockRoleBindingFindMany: vi.fn(),
}));

const scimMocks = vi.hoisted(() => ({
  findUserByUserName: vi.fn(),
  createUser: vi.fn(),
  replaceUser: vi.fn(),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  replaceGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenantUser: { findMany: mockTenantUserFindMany },
    roleBinding: { findMany: mockRoleBindingFindMany },
  },
}));

vi.mock('@platform/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@platform/scim', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ScimClient: vi.fn(() => scimMocks),
  };
});

import { convergeAppInstance, type AppInstanceWithApp } from './app-sync-targets.js';

const INSTANCE = {
  id: 'inst-1',
  tenantId: 'tenant-1',
  scimBaseUrl: 'http://riogentix.t-acme.svc/scim/v2',
  scimToken: 'token',
  app: { slug: 'riogentix' },
} as unknown as AppInstanceWithApp;

const ALICE = {
  userId: 'saas-alice',
  status: 'ACTIVE',
  user: { id: 'saas-alice', email: 'alice@acme.com', name: 'Alice', status: 'ACTIVE' },
};

const ADMIN_BINDING = {
  tenantId: 'tenant-1',
  userId: 'saas-alice',
  roleId: 'role-admin',
  role: {
    id: 'role-admin',
    name: 'tenant_admin',
    isSystem: true,
    permissions: [{ permission: { code: 'users:update' } }, { permission: { code: 'notes:read' } }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantUserFindMany.mockResolvedValue([ALICE]);
  mockRoleBindingFindMany.mockResolvedValue([ADMIN_BINDING]);
  scimMocks.findUserByUserName.mockResolvedValue(null);
  scimMocks.createUser.mockResolvedValue({ id: 'app-alice', active: true });
  scimMocks.listGroups.mockResolvedValue([]);
  scimMocks.createGroup.mockResolvedValue({});
  scimMocks.replaceGroup.mockResolvedValue({});
  scimMocks.deleteGroup.mockResolvedValue(undefined);
});

describe('convergeAppInstance', () => {
  it('creates missing users and groups with role extension', async () => {
    await convergeAppInstance(INSTANCE);

    expect(scimMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'alice@acme.com', externalId: 'saas-alice' }),
    );
    expect(scimMocks.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'role-admin',
        displayName: 'tenant_admin',
        members: [{ value: 'app-alice' }],
        [SCIM_ROLE_EXTENSION]: { permissions: ['users:update', 'notes:read'], isSystem: true },
      }),
    );
  });

  it('reuses existing app users without rewriting them when state matches', async () => {
    scimMocks.findUserByUserName.mockResolvedValue({
      id: 'app-alice',
      externalId: 'saas-alice',
      active: true,
    });

    await convergeAppInstance(INSTANCE);

    expect(scimMocks.createUser).not.toHaveBeenCalled();
    expect(scimMocks.replaceUser).not.toHaveBeenCalled();
  });

  it('deactivates suspended members on the app side', async () => {
    mockTenantUserFindMany.mockResolvedValue([{ ...ALICE, status: 'SUSPENDED' }]);
    scimMocks.findUserByUserName.mockResolvedValue({
      id: 'app-alice',
      externalId: 'saas-alice',
      active: true,
    });

    await convergeAppInstance(INSTANCE);

    expect(scimMocks.replaceUser).toHaveBeenCalledWith(
      'app-alice',
      expect.objectContaining({ active: false }),
    );
  });

  it('replaces existing groups matched by externalId', async () => {
    scimMocks.listGroups.mockResolvedValue([
      { id: 'app-group-1', externalId: 'role-admin', displayName: 'old_name' },
    ]);

    await convergeAppInstance(INSTANCE);

    expect(scimMocks.replaceGroup).toHaveBeenCalledWith(
      'app-group-1',
      expect.objectContaining({ displayName: 'tenant_admin' }),
    );
    expect(scimMocks.createGroup).not.toHaveBeenCalled();
  });

  it('deletes platform-managed groups whose role no longer has bindings', async () => {
    mockRoleBindingFindMany.mockResolvedValue([]);
    scimMocks.listGroups.mockResolvedValue([
      { id: 'app-group-1', externalId: 'role-gone', displayName: 'stale' },
      { id: 'app-group-2', displayName: 'app-native group with no externalId' },
    ]);

    await convergeAppInstance(INSTANCE);

    expect(scimMocks.deleteGroup).toHaveBeenCalledWith('app-group-1');
    expect(scimMocks.deleteGroup).toHaveBeenCalledTimes(1);
  });

  it('skips deleted users entirely', async () => {
    mockTenantUserFindMany.mockResolvedValue([
      { ...ALICE, user: { ...ALICE.user, status: 'DELETED' } },
    ]);
    mockRoleBindingFindMany.mockResolvedValue([ADMIN_BINDING]);

    await convergeAppInstance(INSTANCE);

    expect(scimMocks.createUser).not.toHaveBeenCalled();
    // Binding's user has no app identity — group still created but empty.
    expect(scimMocks.createGroup).not.toHaveBeenCalled();
  });
});
