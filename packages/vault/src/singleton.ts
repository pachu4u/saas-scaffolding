/**
 * Module-level singleton Vault client and secret helpers.
 * Uses lazy initialization so the client is created on first use.
 */

import { VaultClient } from './client';
import { TenantSecrets, PlatformSecrets } from './secrets';

let _client: VaultClient | null = null;
let _tenantSecrets: TenantSecrets | null = null;
let _platformSecrets: PlatformSecrets | null = null;

import type { VaultConfig } from './client';

function getVaultConfig(): VaultConfig {
  const endpoint = process.env.VAULT_ADDR ?? 'http://localhost:8200';
  const token = process.env.VAULT_TOKEN;
  const roleId = process.env.VAULT_ROLE_ID;
  const secretId = process.env.VAULT_SECRET_ID;
  const namespace = process.env.VAULT_NAMESPACE;
  const mountPath = process.env.VAULT_MOUNT_PATH ?? 'secret';

  if (!token && (!roleId || !secretId)) {
    // In dev mode, use a default dev token; in prod this will fail
    if (process.env.NODE_ENV !== 'production') {
      return { endpoint, token: 'root', mountPath, ...(namespace !== undefined && { namespace }) };
    }
    throw new Error('Vault: VAULT_TOKEN or VAULT_ROLE_ID+VAULT_SECRET_ID must be set');
  }

  const cfg: VaultConfig = { endpoint, mountPath };
  if (token !== undefined) cfg.token = token;
  if (roleId !== undefined) cfg.roleId = roleId;
  if (secretId !== undefined) cfg.secretId = secretId;
  if (namespace !== undefined) cfg.namespace = namespace;
  return cfg;
}

export function getVaultClient(): VaultClient {
  if (!_client) {
    _client = new VaultClient(getVaultConfig());
  }
  return _client;
}

export function getTenantSecrets(): TenantSecrets {
  if (!_tenantSecrets) {
    _tenantSecrets = new TenantSecrets(getVaultClient());
  }
  return _tenantSecrets;
}

export function getPlatformSecrets(): PlatformSecrets {
  if (!_platformSecrets) {
    _platformSecrets = new PlatformSecrets(getVaultClient());
  }
  return _platformSecrets;
}

/** Reset singletons (useful for testing). */
export function resetVaultSingletons(): void {
  _client = null;
  _tenantSecrets = null;
  _platformSecrets = null;
}
