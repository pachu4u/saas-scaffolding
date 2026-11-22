import { createSign, randomUUID } from 'node:crypto';

/**
 * Minimal STACKIT API client for PostgreSQL Flex users.
 *
 * Postgres Flex never grants SQL users CREATEROLE, so the only way to give
 * each tenant its own login is the Flex management API. STACKIT ships no
 * JS SDK; this implements the same service-account "key flow" the Go/Python
 * SDKs use: sign a short-lived JWT with the key's private key, exchange it
 * at the key's token endpoint for a bearer token.
 */

interface ServiceAccountKey {
  credentials: {
    kid: string;
    iss: string;
    sub: string;
    aud: string;
    privateKey: string;
    tokenEndpoint?: string;
  };
}

export interface FlexUserCredentials {
  id: string;
  username: string;
  password: string;
}

export interface FlexClientOptions {
  serviceAccountKey: string;
  projectId: string;
  region: string;
  instanceId: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TOKEN_ENDPOINT = 'https://service-account.api.stackit.cloud/token';
const API_BASE = 'https://postgres-flex-service.api.stackit.cloud/v2';

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export function signKeyFlowAssertion(key: ServiceAccountKey, nowSeconds: number): string {
  const { kid, iss, sub, aud, privateKey } = key.credentials;
  const header = b64url(JSON.stringify({ alg: 'RS512', typ: 'JWT', kid }));
  const payload = b64url(
    JSON.stringify({ iss, sub, aud, jti: randomUUID(), iat: nowSeconds, exp: nowSeconds + 600 }),
  );
  const signer = createSign('RSA-SHA512');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`;
}

export class FlexClient {
  private readonly key: ServiceAccountKey;
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | undefined;

  constructor(private readonly opts: FlexClientOptions) {
    this.key = JSON.parse(opts.serviceAccountKey) as ServiceAccountKey;
    if (!(this.key as Partial<ServiceAccountKey>).credentials?.privateKey) {
      throw new Error('STACKIT_SERVICE_ACCOUNT_KEY is not a service-account key JSON');
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async bearer(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value;
    const res = await this.fetchImpl(this.key.credentials.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signKeyFlowAssertion(this.key, now),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`STACKIT token exchange → ${String(res.status)}`);
    }
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    this.token = { value: body.access_token, expiresAt: now + (body.expires_in ?? 600) };
    return body.access_token;
  }

  private usersUrl(suffix = ''): string {
    const { projectId, region, instanceId } = this.opts;
    return `${API_BASE}/projects/${projectId}/regions/${region}/instances/${instanceId}/users${suffix}`;
  }

  private async call<T>(method: string, url: string, body?: unknown): Promise<T | undefined> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${await this.bearer()}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 404 && method === 'DELETE') return undefined;
    if (!res.ok) {
      // Never echo the response body: create/reset responses carry passwords.
      throw new Error(`Postgres Flex ${method} ${new URL(url).pathname} → ${String(res.status)}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : undefined;
  }

  async findUser(username: string): Promise<{ id: string } | undefined> {
    const body = await this.call<{ items?: { id: string | number; username: string }[] }>(
      'GET',
      this.usersUrl(),
    );
    const match = body?.items?.find((u) => u.username === username);
    return match && { id: String(match.id) };
  }

  /** Create a login-only user. The password is only ever returned here. */
  async createUser(username: string): Promise<FlexUserCredentials> {
    const body = await this.call<{ item: { id: string | number; password: string } }>(
      'POST',
      this.usersUrl(),
      { username, roles: ['login'] },
    );
    if (!body?.item.password) throw new Error('Postgres Flex create user returned no password');
    return { id: String(body.item.id), username, password: body.item.password };
  }

  /** Rotate an existing user's password (Flex never returns it again after create). */
  async resetPassword(userId: string, username: string): Promise<FlexUserCredentials> {
    const body = await this.call<{ item: { password: string } }>(
      'POST',
      this.usersUrl(`/${userId}/reset`),
    );
    if (!body?.item.password) throw new Error('Postgres Flex reset returned no password');
    return { id: userId, username, password: body.item.password };
  }

  async deleteUser(userId: string): Promise<void> {
    await this.call('DELETE', this.usersUrl(`/${userId}`));
  }

  /** Create the user, or reset its password if it already exists. */
  async ensureUser(username: string): Promise<FlexUserCredentials> {
    const existing = await this.findUser(username);
    return existing ? this.resetPassword(existing.id, username) : this.createUser(username);
  }
}
