/**
 * Platform-specific secret management helpers built on top of VaultClient.
 *
 * Secret paths follow the convention:
 *   tenants/{tenantId}/webhooks/{endpointId}
 *   tenants/{tenantId}/scim/{tokenId}
 *   tenants/{tenantId}/db
 *   tenants/{tenantId}/api-keys/{keyId}
 *   platform/stripe
 *   platform/email
 */

import { type VaultClient, type SecretData } from './client';

export class TenantSecrets {
  constructor(private readonly vault: VaultClient) {}

  // ── Webhook Secrets ─────────────────────────────────────────────────────────

  async storeWebhookSecret(tenantId: string, endpointId: string, secret: string): Promise<void> {
    await this.vault.writeSecret(`tenants/${tenantId}/webhooks/${endpointId}`, { secret });
  }

  async getWebhookSecret(tenantId: string, endpointId: string): Promise<string | null> {
    const data = await this.vault.readSecret(`tenants/${tenantId}/webhooks/${endpointId}`);
    return data?.secret ?? null;
  }

  async deleteWebhookSecret(tenantId: string, endpointId: string): Promise<void> {
    await this.vault.deleteSecret(`tenants/${tenantId}/webhooks/${endpointId}`);
  }

  // ── SCIM Token Secrets ──────────────────────────────────────────────────────

  async storeScimTokenSecret(tenantId: string, tokenId: string, rawToken: string): Promise<void> {
    await this.vault.writeSecret(`tenants/${tenantId}/scim/${tokenId}`, { token: rawToken });
  }

  async getScimTokenSecret(tenantId: string, tokenId: string): Promise<string | null> {
    const data = await this.vault.readSecret(`tenants/${tenantId}/scim/${tokenId}`);
    return data?.token ?? null;
  }

  async deleteScimTokenSecret(tenantId: string, tokenId: string): Promise<void> {
    await this.vault.deleteSecret(`tenants/${tenantId}/scim/${tokenId}`);
  }

  // ── Database Credentials ────────────────────────────────────────────────────

  async storeTenantDbCredentials(
    tenantId: string,
    creds: { username: string; password: string; host: string; dbName: string },
  ): Promise<void> {
    await this.vault.writeSecret(`tenants/${tenantId}/db`, creds as unknown as SecretData);
  }

  async getTenantDbCredentials(
    tenantId: string,
  ): Promise<{ username: string; password: string; host: string; dbName: string } | null> {
    const data = await this.vault.readSecret(`tenants/${tenantId}/db`);
    if (!data) return null;
    return data as unknown as { username: string; password: string; host: string; dbName: string };
  }

  // ── API Keys ────────────────────────────────────────────────────────────────

  async storeApiKey(tenantId: string, keyId: string, secret: string): Promise<void> {
    await this.vault.writeSecret(`tenants/${tenantId}/api-keys/${keyId}`, { secret });
  }

  async getApiKey(tenantId: string, keyId: string): Promise<string | null> {
    const data = await this.vault.readSecret(`tenants/${tenantId}/api-keys/${keyId}`);
    return data?.secret ?? null;
  }

  async deleteApiKey(tenantId: string, keyId: string): Promise<void> {
    await this.vault.deleteSecret(`tenants/${tenantId}/api-keys/${keyId}`);
  }

  // ── All tenant secrets ──────────────────────────────────────────────────────

  async deleteAllTenantSecrets(tenantId: string): Promise<void> {
    await this.vault.deleteSecret(`tenants/${tenantId}`);
  }
}

export class PlatformSecrets {
  constructor(private readonly vault: VaultClient) {}

  async storeStripeKeys(
    publishableKey: string,
    secretKey: string,
    webhookSecret: string,
  ): Promise<void> {
    await this.vault.writeSecret('platform/stripe', {
      publishable_key: publishableKey,
      secret_key: secretKey,
      webhook_secret: webhookSecret,
    });
  }

  async getStripeKeys(): Promise<{
    publishable_key: string;
    secret_key: string;
    webhook_secret: string;
  } | null> {
    const data = await this.vault.readSecret('platform/stripe');
    if (!data) return null;
    return data as unknown as {
      publishable_key: string;
      secret_key: string;
      webhook_secret: string;
    };
  }

  async storeEmailConfig(apiKey: string, fromEmail: string): Promise<void> {
    await this.vault.writeSecret('platform/email', { api_key: apiKey, from_email: fromEmail });
  }

  async getEmailConfig(): Promise<{ api_key: string; from_email: string } | null> {
    const data = await this.vault.readSecret('platform/email');
    if (!data) return null;
    return data as unknown as { api_key: string; from_email: string };
  }
}
