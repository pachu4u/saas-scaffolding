import { describe, it, expect, vi } from 'vitest';

// groups.ts also exports DB-backed functions — mock @platform/db so importing
// the module for the pure toScimGroup mapper doesn't trigger real env validation.
vi.mock('@platform/db', () => ({ adminDb: {} }));
vi.mock('@platform/logger/audit', () => ({ auditLog: vi.fn() }));

import { toScimGroup } from './groups.js';

describe('toScimGroup', () => {
  it('maps a role with bindings to the SCIM Group schema', () => {
    const role = {
      id: 'role-1',
      name: 'tenant_admin',
      bindings: [
        { userId: 'u1', user: { email: 'alice@acme.test' } },
        { userId: 'u2', user: { email: 'bob@acme.test' } },
      ],
    };

    const scim = toScimGroup(role, 'https://acme.lvh.me');

    expect(scim.id).toBe('role-1');
    expect(scim.displayName).toBe('tenant_admin');
    expect(scim.members).toEqual([
      { value: 'u1', display: 'alice@acme.test' },
      { value: 'u2', display: 'bob@acme.test' },
    ]);
    expect(scim.meta.location).toBe('https://acme.lvh.me/scim/v2/Groups/role-1');
  });

  it('returns an empty members array for a role with no bindings', () => {
    const role = { id: 'role-2', name: 'tenant_viewer', bindings: [] };

    const scim = toScimGroup(role, 'https://acme.lvh.me');

    expect(scim.members).toEqual([]);
  });
});
