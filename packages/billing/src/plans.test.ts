import { describe, it, expect } from 'vitest';

import { PLAN_CODES, PLAN_FEATURES } from './plans.js';

describe('PLAN_FEATURES', () => {
  it('has an entry for every PLAN_CODE', () => {
    for (const code of PLAN_CODES) {
      expect(PLAN_FEATURES[code]).toBeDefined();
    }
  });

  it('free plan has the most restrictive limits', () => {
    expect(PLAN_FEATURES.free.notes.maxCount).not.toBeNull();
    expect(PLAN_FEATURES.free.users.maxCount).not.toBeNull();
    expect(PLAN_FEATURES.free.scim).toBe(false);
    expect(PLAN_FEATURES.free.webhooks).toBe(false);
    expect(PLAN_FEATURES.free.customDomain).toBe(false);
  });

  it('enterprise plan has unlimited notes and users', () => {
    expect(PLAN_FEATURES.enterprise.notes.maxCount).toBeNull();
    expect(PLAN_FEATURES.enterprise.users.maxCount).toBeNull();
  });

  it('plan limits never loosen going from free to enterprise', () => {
    const tiers: (typeof PLAN_CODES)[number][] = ['free', 'pro', 'enterprise'];
    const userLimits = tiers.map((t) => PLAN_FEATURES[t].users.maxCount);
    for (let i = 1; i < userLimits.length; i++) {
      const prev = userLimits[i - 1];
      const cur = userLimits[i];
      // null means "unlimited" — always >= a finite previous limit
      if (prev != null && cur != null) {
        expect(cur).toBeGreaterThanOrEqual(prev);
      } else {
        expect(cur === null || prev != null).toBe(true);
      }
    }
  });
});
