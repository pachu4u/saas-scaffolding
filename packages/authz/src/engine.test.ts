import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — use vi.hoisted() so variables are available in the factory
const {
  mockRoleBindingFindMany,
  mockSubscriptionFindUnique,
  mockRedisGet,
  mockRedisSetex,
} = vi.hoisted(() => ({
  mockRoleBindingFindMany: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSetex: vi.fn(),
}));

vi.mock('@platform/db', () => ({
  adminDb: {
    roleBinding: { findMany: mockRoleBindingFindMany },
    subscription: { findUnique: mockSubscriptionFindUnique },
  },
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: vi.fn(),
  },
}));

import { can, hasEntitlement } from './engine';
import { isOwnerPolicy, isSelfPolicy } from './policies';
import type { AuthzContext } from './engine';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const TENANT_ID = 'tenant-uuid-1';

const ctx: AuthzContext = {
  user: { id: USER_ID, externalId: 'kc-sub-1', email: 'alice@acme.test' },
  tenantId: TENANT_ID,
  plan: 'pro',
};

function makeBinding(roleName: string, permCodes: string[]) {
  return {
    role: {
      name: roleName,
      permissions: permCodes.map((code) => ({ permission: { code } })),
    },
  };
}

// ─── can() ───────────────────────────────────────────────────────────────────

describe('can()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue('OK');
  });

  it('grants permission when role binding includes it', async () => {
    mockRoleBindingFindMany.mockResolvedValue([
      makeBinding('tenant_admin', ['notes:create', 'notes:delete']),
    ]);
    expect(await can(ctx, 'notes:create')).toBe(true);
  });

  it('denies permission the role does not have', async () => {
    mockRoleBindingFindMany.mockResolvedValue([
      makeBinding('tenant_viewer', ['notes:read', 'users:read']),
    ]);
    expect(await can(ctx, 'notes:delete')).toBe(false);
  });

  it('denies when user has no role bindings at all', async () => {
    mockRoleBindingFindMany.mockResolvedValue([]);
    expect(await can(ctx, 'notes:create')).toBe(false);
  });

  it('falls back to ROLE_PERMISSIONS static map when DB perms are empty', async () => {
    // Binding exists but role_permissions junction is empty in DB —
    // engine should fall back to static ROLE_PERMISSIONS constant.
    mockRoleBindingFindMany.mockResolvedValue([
      makeBinding('tenant_user', []), // no DB-side perms wired
    ]);
    // tenant_user has notes:create in the static map
    expect(await can(ctx, 'notes:create')).toBe(true);
    expect(await can(ctx, 'notes:delete')).toBe(false);
  });

  it('uses cached result when Redis has a hit', async () => {
    const cached = { roles: ['tenant_admin'], permissions: ['notes:delete'] };
    mockRedisGet.mockResolvedValue(JSON.stringify(cached));
    expect(await can(ctx, 'notes:delete')).toBe(true);
    expect(mockRoleBindingFindMany).not.toHaveBeenCalled();
  });

  it('platform_super_admin has every permission', async () => {
    mockRoleBindingFindMany.mockResolvedValue([
      makeBinding('platform_super_admin', []),
    ]);
    expect(await can(ctx, 'platform:admin')).toBe(true);
    expect(await can(ctx, 'scim:manage')).toBe(true);
  });
});

// ─── hasEntitlement() ────────────────────────────────────────────────────────

describe('hasEntitlement()', () => {
  it('returns true for a pro plan feature that is enabled', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: { features: { notes: { maxCount: 1000, delete: true } } },
    });
    expect(await hasEntitlement(TENANT_ID, 'notes.delete')).toBe(true);
  });

  it('returns false when the feature is explicitly false', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: { features: { notes: { maxCount: 10, delete: false } } },
    });
    expect(await hasEntitlement(TENANT_ID, 'notes.delete')).toBe(false);
  });

  it('returns false when the feature key does not exist', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: { features: {} },
    });
    expect(await hasEntitlement(TENANT_ID, 'notes.delete')).toBe(false);
  });

  it('returns false when there is no subscription', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(null);
    expect(await hasEntitlement(TENANT_ID, 'notes.delete')).toBe(false);
  });

  it('handles nested boolean true features (e.g. scim)', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: { features: { scim: true } },
    });
    expect(await hasEntitlement(TENANT_ID, 'scim')).toBe(true);
  });
});

// ─── ABAC policies ───────────────────────────────────────────────────────────

describe('isOwnerPolicy()', () => {
  it('returns true when resource userId matches caller', () => {
    expect(isOwnerPolicy(ctx, USER_ID)).toBe(true);
  });

  it('returns false when resource userId is a different user', () => {
    expect(isOwnerPolicy(ctx, 'other-user-uuid')).toBe(false);
  });

  it('returns false when resource userId is null', () => {
    expect(isOwnerPolicy(ctx, null)).toBe(false);
  });

  it('returns false when resource userId is undefined', () => {
    expect(isOwnerPolicy(ctx, undefined)).toBe(false);
  });
});

describe('isSelfPolicy()', () => {
  it('returns true when target matches caller', () => {
    expect(isSelfPolicy(ctx, USER_ID)).toBe(true);
  });

  it('returns false when target is a different user', () => {
    expect(isSelfPolicy(ctx, 'other-uuid')).toBe(false);
  });
});
