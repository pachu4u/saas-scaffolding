import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  branding: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('No tenant context — call only within a tenant-scoped request');
  }
  return ctx;
}
