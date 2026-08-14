import { SCIM_ROLE_EXTENSION } from '@platform/scim';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTenantUserFindMany,
  mockRoleBindingFindMany,
  mockRoleFindFirst,
  mockRoleCreate,
  mockTenantFindUnique,
} = vi.hoisted(() => ({
  mockTenantUserFindMany: vi.fn(),
  mockRoleBindingFindMany: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockTenantFindUnique: vi.fn(),
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

const riogentixClientMocks = vi.hoisted(() => ({
  syncBranding: vi.fn(),
  syncResourceLimits: vi.fn(),
  fetchRiogentixRoles: vi.fn(),
  fetchRiogentixAssignments: vi.fn(),
  createRiogentixAssignment: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    tenantUser: { findMany: mockTenantUserFindMany },
    roleBinding: { findMany: mockRoleBindingFindMany },
    role: { findFirst: mockRoleFindFirst, create: mockRoleCreate },
    tenant: { findUnique: mockTenantFindUnique },
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

vi.mock('./riogentix-client.js', () => riogentixClientMocks);

import { convergeAppInstance, type AppInstanceWithApp } from './app-sync-targets.js';

// Generic connected-app fixture (NOT riogentix) — exercises the SCIM Groups
// push path, which still applies unchanged to every app other than
// Riogentix. Riogentix-specific behavior (native role assignments, no SCIM
// group push) is covered in its own describe block below.
const INSTANCE = {
  id: 'inst-1',
  tenantId: 'tenant-1',
  appId: 'app-other',
  scimBaseUrl: 'http://other-app.t-acme.svc/scim/v2',
  scimToken: 'token',
  app: { slug: 'other-app' },
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

  it('only fetches bindings for app-agnostic roles or roles scoped to this instance app', async () => {
    await convergeAppInstance(INSTANCE);

    expect(mockRoleBindingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          role: { OR: [{ appId: null }, { appId: 'app-other' }] },
        },
      }),
    );
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

describe('convergeAppInstance for riogentix', () => {
  const RIOGENTIX_INSTANCE = {
    id: 'inst-2',
    tenantId: 'tenant-1',
    appId: 'app-riogentix',
    scimBaseUrl: 'http://riogentix.t-acme.svc/scim/v2',
    scimToken: 'token',
    app: { slug: 'riogentix' },
  } as unknown as AppInstanceWithApp;

  const NATIVE_ADMIN_BINDING = {
    tenantId: 'tenant-1',
    userId: 'saas-alice',
    roleId: 'saas-role-admin',
    role: {
      id: 'saas-role-admin',
      appId: 'app-riogentix',
      name: 'admin',
      isSystem: true,
      permissions: [],
    },
  };

  beforeEach(() => {
    mockTenantFindUnique.mockResolvedValue({ branding: {}, resourceLimits: {} });
    mockRoleFindFirst.mockResolvedValue({ id: 'saas-role-admin', name: 'admin' });
    riogentixClientMocks.syncBranding.mockResolvedValue(undefined);
    riogentixClientMocks.syncResourceLimits.mockResolvedValue(undefined);
    riogentixClientMocks.fetchRiogentixRoles.mockResolvedValue([
      { id: 'native-admin-id', name: 'admin', isSystem: true, permissions: ['flow:read'] },
    ]);
    riogentixClientMocks.fetchRiogentixAssignments.mockResolvedValue([]);
    riogentixClientMocks.createRiogentixAssignment.mockResolvedValue({ id: 'assignment-1' });
    scimMocks.findUserByUserName.mockResolvedValue({
      id: 'app-alice',
      externalId: 'saas-alice',
      active: true,
    });
  });

  it('never pushes SCIM groups for riogentix', async () => {
    mockRoleBindingFindMany.mockResolvedValue([NATIVE_ADMIN_BINDING]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(scimMocks.listGroups).not.toHaveBeenCalled();
    expect(scimMocks.createGroup).not.toHaveBeenCalled();
    expect(scimMocks.replaceGroup).not.toHaveBeenCalled();
    expect(scimMocks.deleteGroup).not.toHaveBeenCalled();
  });

  it('pushes the tenant resource-limit overrides on every converge pass', async () => {
    mockTenantFindUnique.mockResolvedValue({
      branding: {},
      resourceLimits: { pipes: 10, seats: null },
    });
    mockRoleBindingFindMany.mockResolvedValue([NATIVE_ADMIN_BINDING]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.syncResourceLimits).toHaveBeenCalledWith('tenant-1', {
      pipes: 10,
      storageBytes: undefined,
      apiKeys: undefined,
      seats: null,
    });
  });

  it('creates a native assignment for a desired app-scoped role binding', async () => {
    mockRoleBindingFindMany.mockResolvedValue([NATIVE_ADMIN_BINDING]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
      'tenant-1',
      'app-alice',
      'native-admin-id',
    );
  });

  it('materializes a native role as an app-scoped SaaS Role row when missing', async () => {
    mockRoleFindFirst.mockResolvedValue(null);
    mockRoleBindingFindMany.mockResolvedValue([]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(mockRoleCreate).toHaveBeenCalledWith({
      data: { tenantId: null, appId: 'app-riogentix', name: 'admin', isSystem: true },
    });
  });

  it('does not re-create an assignment the user already holds', async () => {
    mockRoleBindingFindMany.mockResolvedValue([NATIVE_ADMIN_BINDING]);
    riogentixClientMocks.fetchRiogentixAssignments.mockResolvedValue([
      {
        id: 'existing',
        userId: 'app-alice',
        roleId: 'native-admin-id',
        domainType: 'global',
        domainId: null,
      },
    ]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.createRiogentixAssignment).not.toHaveBeenCalled();
  });

  it('never calls delete — additive only, does not revoke assignments it did not push', async () => {
    mockRoleBindingFindMany.mockResolvedValue([]);
    riogentixClientMocks.fetchRiogentixAssignments.mockResolvedValue([
      {
        id: 'bootstrap-grant',
        userId: 'app-alice',
        roleId: 'native-admin-id',
        domainType: 'global',
        domainId: null,
      },
    ]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.createRiogentixAssignment).not.toHaveBeenCalled();
    // No delete client function exists to have been called — this test's real
    // assertion is the one above: an assignment with no matching desired
    // binding is left alone, not diffed away.
  });

  it('skips a binding whose role has no matching native role (catalog drift)', async () => {
    mockRoleBindingFindMany.mockResolvedValue([
      { ...NATIVE_ADMIN_BINDING, role: { ...NATIVE_ADMIN_BINDING.role, name: 'nonexistent-role' } },
    ]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.createRiogentixAssignment).not.toHaveBeenCalled();
  });

  it('skips a binding for a user with no riogentix identity', async () => {
    mockRoleBindingFindMany.mockResolvedValue([{ ...NATIVE_ADMIN_BINDING, userId: 'saas-bob' }]);

    await convergeAppInstance(RIOGENTIX_INSTANCE);

    expect(riogentixClientMocks.createRiogentixAssignment).not.toHaveBeenCalled();
  });

  describe('platform-wide role bindings (appId: null)', () => {
    const platformBinding = (permissions: string[]) => ({
      tenantId: 'tenant-1',
      userId: 'saas-carol',
      roleId: 'saas-role-tenant_viewer',
      role: {
        id: 'saas-role-tenant_viewer',
        appId: null,
        name: 'tenant_viewer',
        isSystem: true,
        permissions: permissions.map((code) => ({ permission: { code } })),
      },
    });

    beforeEach(() => {
      mockTenantUserFindMany.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          userId: 'saas-carol',
          status: 'ACTIVE',
          user: { id: 'saas-carol', email: 'carol@acme.com', name: 'Carol', status: 'ACTIVE' },
        },
      ]);
      riogentixClientMocks.fetchRiogentixRoles.mockResolvedValue([
        { id: 'native-admin-id', name: 'admin', isSystem: true, permissions: ['flow:read'] },
        { id: 'native-developer-id', name: 'developer', isSystem: true, permissions: [] },
        { id: 'native-viewer-id', name: 'viewer', isSystem: true, permissions: [] },
      ]);
      scimMocks.findUserByUserName.mockResolvedValue({
        id: 'app-carol',
        externalId: 'saas-carol',
        active: true,
      });
    });

    it('maps a platform-wide viewer-tier role to the native viewer role, closing the stranded-user gap', async () => {
      mockRoleBindingFindMany.mockResolvedValue([platformBinding(['notes:read', 'users:read'])]);

      await convergeAppInstance(RIOGENTIX_INSTANCE);

      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
        'tenant-1',
        'app-carol',
        'native-viewer-id',
      );
    });

    it('maps a platform-wide admin-tier role (notes:delete) to the native admin role', async () => {
      mockRoleBindingFindMany.mockResolvedValue([
        platformBinding(['notes:read', 'notes:create', 'notes:update', 'notes:delete']),
      ]);

      await convergeAppInstance(RIOGENTIX_INSTANCE);

      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
        'tenant-1',
        'app-carol',
        'native-admin-id',
      );
    });

    it('maps a platform-wide developer-tier role (notes:create/update) to the native developer role', async () => {
      mockRoleBindingFindMany.mockResolvedValue([
        platformBinding(['notes:read', 'notes:create', 'notes:update']),
      ]);

      await convergeAppInstance(RIOGENTIX_INSTANCE);

      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
        'tenant-1',
        'app-carol',
        'native-developer-id',
      );
    });

    it('falls back to viewer for a platform-wide role with no recognized tier permissions', async () => {
      mockRoleBindingFindMany.mockResolvedValue([platformBinding(['billing:read'])]);

      await convergeAppInstance(RIOGENTIX_INSTANCE);

      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
        'tenant-1',
        'app-carol',
        'native-viewer-id',
      );
    });

    it('does not apply the platform-wide tier mapping when the user already has an explicit app-scoped role', async () => {
      mockRoleBindingFindMany.mockResolvedValue([
        { ...NATIVE_ADMIN_BINDING, userId: 'saas-carol' },
        platformBinding(['notes:read']),
      ]);

      await convergeAppInstance(RIOGENTIX_INSTANCE);

      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledTimes(1);
      expect(riogentixClientMocks.createRiogentixAssignment).toHaveBeenCalledWith(
        'tenant-1',
        'app-carol',
        'native-admin-id',
      );
    });
  });
});
