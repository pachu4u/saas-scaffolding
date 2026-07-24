export { VaultClient, VaultError } from './client.js';
export type { VaultConfig, SecretData } from './client.js';
export { TenantSecrets, PlatformSecrets } from './secrets.js';
export {
  getVaultClient,
  getTenantSecrets,
  getPlatformSecrets,
  resetVaultSingletons,
} from './singleton.js';
