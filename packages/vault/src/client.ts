/**
 * HashiCorp Vault client for KV v2 secrets engine.
 *
 * Supports:
 * - Token authentication (dev/test)
 * - AppRole authentication (production)
 * - KV v2 read/write/delete
 * - Health checks
 */

export interface VaultConfig {
  endpoint: string; // e.g. http://localhost:8200
  token?: string; // Static token (dev mode)
  roleId?: string; // AppRole role_id
  secretId?: string; // AppRole secret_id
  namespace?: string; // Vault namespace (Enterprise)
  mountPath?: string; // KV mount path, defaults to 'secret'
  timeout?: number; // Request timeout ms
}

export interface SecretData {
  [key: string]: string;
}

export class VaultClient {
  private config: Required<Pick<VaultConfig, 'endpoint' | 'mountPath' | 'timeout'>> &
    Omit<VaultConfig, 'endpoint' | 'mountPath' | 'timeout'>;
  private token: string | null;
  private tokenExpiry: number | null;

  constructor(config: VaultConfig) {
    this.config = {
      ...config,
      mountPath: config.mountPath ?? 'secret',
      timeout: config.timeout ?? 5_000,
    };
    this.token = config.token ?? null;
    this.tokenExpiry = null;
  }

  private get baseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace;
    }
    if (this.token) {
      headers['X-Vault-Token'] = this.token;
    }
    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.endpoint}/v1/${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.baseHeaders,
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new VaultError(
          `Vault request failed: ${response.status} ${response.statusText} — ${errorText}`,
          response.status,
        );
      }

      // 204 No Content (e.g. delete)
      if (response.status === 204) return {} as T;

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Authenticate via AppRole. Call this before making secret requests when
   * using AppRole auth (production). Token-based auth does not need this.
   */
  async authenticate(): Promise<void> {
    if (this.config.token) {
      this.token = this.config.token;
      return;
    }

    if (!this.config.roleId || !this.config.secretId) {
      throw new VaultError('Vault: either token or roleId+secretId must be provided', 400);
    }

    const response = await this.request<{
      auth: { client_token: string; lease_duration: number };
    }>('POST', 'auth/approle/login', {
      role_id: this.config.roleId,
      secret_id: this.config.secretId,
    });

    this.token = response.auth.client_token;
    this.tokenExpiry = Date.now() + response.auth.lease_duration * 1_000 - 60_000; // 1min buffer
  }

  /** Ensure we have a valid token. */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.token || (this.tokenExpiry && Date.now() > this.tokenExpiry)) {
      await this.authenticate();
    }
  }

  /**
   * Write a secret to KV v2.
   * @param path - Secret path relative to mount (e.g. 'tenants/tenant-id/db')
   * @param data - Key-value pairs to store
   */
  async writeSecret(path: string, data: SecretData): Promise<void> {
    await this.ensureAuthenticated();
    await this.request('POST', `${this.config.mountPath}/data/${path}`, { data });
  }

  /**
   * Read a secret from KV v2.
   * Returns the latest version's data, or null if not found.
   */
  async readSecret(path: string): Promise<SecretData | null> {
    await this.ensureAuthenticated();
    try {
      const response = await this.request<{
        data: { data: SecretData; metadata: { version: number } };
      }>('GET', `${this.config.mountPath}/data/${path}`);
      return response.data.data;
    } catch (err) {
      if (err instanceof VaultError && err.statusCode === 404) return null;
      throw err;
    }
  }

  /**
   * Delete a secret from KV v2 (all versions).
   */
  async deleteSecret(path: string): Promise<void> {
    await this.ensureAuthenticated();
    await this.request('DELETE', `${this.config.mountPath}/metadata/${path}`);
  }

  /**
   * List secrets at a path prefix.
   */
  async listSecrets(path: string): Promise<string[]> {
    await this.ensureAuthenticated();
    try {
      const response = await this.request<{
        data: { keys: string[] };
      }>('LIST', `${this.config.mountPath}/metadata/${path}`);
      return response.data.keys;
    } catch (err) {
      if (err instanceof VaultError && err.statusCode === 404) return [];
      throw err;
    }
  }

  /**
   * Check Vault health. Returns true if Vault is initialized, unsealed, and active.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/sys/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      // 200 = initialized, unsealed, active
      // 429 = standby
      // 501 = not initialized
      // 503 = sealed
      return response.status === 200 || response.status === 429;
    } catch {
      return false;
    }
  }
}

export class VaultError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}
