import { env } from '@platform/config';

import { kubernetesDriver, tenantInternalBaseUrl } from './kubernetes-driver.js';
import { sharedDriver } from './shared-driver.js';
import type { TenantStackDriver } from './types.js';

export function getTenantStackDriver(): TenantStackDriver {
  return env.TENANT_STACK_DRIVER === 'kubernetes' ? kubernetesDriver : sharedDriver;
}

export { tenantInternalBaseUrl };
export type { TenantStackDriver, TenantRef, ProvisionOutcome, TenantStackSpec } from './types.js';
