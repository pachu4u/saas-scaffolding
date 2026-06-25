import { describe, it, expect } from 'vitest';

import { runWithTenant, getTenantContext, requireTenantContext } from './context.js';
import type { TenantContext } from './context.js';

const ctx: TenantContext = {
  tenantId: 'tenant-1',
  slug: 'acme',
  name: 'Acme',
  plan: 'pro',
  status: 'ACTIVE',
  branding: {},
};

describe('tenant context (AsyncLocalStorage)', () => {
  it('getTenantContext returns undefined outside any runWithTenant call', () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it('runWithTenant makes the context available to code running inside it', () => {
    runWithTenant(ctx, () => {
      expect(getTenantContext()).toEqual(ctx);
    });
  });

  it('context does not leak outside the runWithTenant callback', () => {
    runWithTenant(ctx, () => undefined);
    expect(getTenantContext()).toBeUndefined();
  });

  it('requireTenantContext returns the context when inside runWithTenant', () => {
    runWithTenant(ctx, () => {
      expect(requireTenantContext()).toEqual(ctx);
    });
  });

  it('requireTenantContext throws when called outside any tenant context', () => {
    expect(() => requireTenantContext()).toThrow(/No tenant context/);
  });

  it('propagates context across async/await boundaries within the same run', async () => {
    await runWithTenant(ctx, async () => {
      await Promise.resolve();
      expect(getTenantContext()).toEqual(ctx);
    });
  });

  it('isolates context across concurrent runWithTenant calls', async () => {
    const ctxB: TenantContext = { ...ctx, tenantId: 'tenant-2', slug: 'globex' };

    const [resultA, resultB] = await Promise.all([
      runWithTenant(ctx, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return getTenantContext()?.slug;
      }),
      runWithTenant(ctxB, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getTenantContext()?.slug;
      }),
    ]);

    expect(resultA).toBe('acme');
    expect(resultB).toBe('globex');
  });
});
