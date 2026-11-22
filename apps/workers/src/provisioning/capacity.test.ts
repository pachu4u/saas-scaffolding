import { describe, expect, it } from 'vitest';

import { capacityRefusal } from './capacity.js';

const limits = { maxTenants: 15, maxDbConnRatio: 0.8 };

describe('capacityRefusal', () => {
  it('allows a new tenant with headroom', () => {
    expect(
      capacityRefusal({ tenantNamespaces: 3, dbConnections: 20, dbMaxConnections: 100 }, limits),
    ).toBeNull();
  });

  it('refuses at the tenant limit', () => {
    expect(
      capacityRefusal({ tenantNamespaces: 15, dbConnections: 20, dbMaxConnections: 100 }, limits),
    ).toMatch(/tenant limit reached \(15\/15\)/);
  });

  it('refuses when Postgres connections are nearly exhausted', () => {
    expect(
      capacityRefusal({ tenantNamespaces: 2, dbConnections: 85, dbMaxConnections: 100 }, limits),
    ).toMatch(/database connections at 85%/);
  });
});
