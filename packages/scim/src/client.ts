// SCIM 2.0 client (RFC 7644) — outbound provisioning to connected apps.
//
// The platform acts as the identity source and pushes users + groups to each
// connected app's SCIM endpoint. Only the small subset of SCIM the apps need
// is implemented: find/create/replace Users, list/create/replace/delete
// Groups. All calls are idempotent-by-construction so the outbox dispatcher
// can replay them freely.

import { SCIM_ROLE_EXTENSION, SCIM_SCHEMAS } from './types';
import type { ScimGroup, ScimListResponse, ScimUser } from './types';

/** User payload the platform manages on the app side (no server-owned fields). */
export interface ScimUserWrite {
  schemas: string[];
  externalId?: string;
  userName: string;
  name?: { formatted?: string; givenName?: string; familyName?: string };
  emails?: { value: string; primary?: boolean; type?: string }[];
  active: boolean;
}

/** Group payload; the role extension carries the platform's permission codes. */
export interface ScimGroupWrite {
  schemas: string[];
  externalId?: string;
  displayName: string;
  members?: { value: string }[];
  [SCIM_ROLE_EXTENSION]?: { permissions: string[]; isSystem: boolean };
}

export class ScimRequestError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    detail: string,
  ) {
    super(`SCIM ${method} ${path} → ${String(status)}: ${detail}`);
    this.name = 'ScimRequestError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class ScimClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/scim+json',
        Accept: 'application/scim+json, application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (res.status === 204) return null;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ScimRequestError(res.status, method, path, detail.slice(0, 500));
    }
    return (await res.json()) as T;
  }

  /** Resolve a user by userName (the cross-system identity key). */
  async findUserByUserName(userName: string): Promise<ScimUser | null> {
    const filter = encodeURIComponent(`userName eq "${userName}"`);
    const list = await this.request<ScimListResponse<ScimUser>>(
      'GET',
      `/Users?filter=${filter}&count=2`,
    );
    return list?.Resources[0] ?? null;
  }

  /**
   * Create a user; a 409 (uniqueness conflict — e.g. concurrent create or a
   * user that predates SCIM) resolves to the existing record instead.
   */
  async createUser(user: ScimUserWrite): Promise<ScimUser> {
    try {
      const created = await this.request<ScimUser>('POST', '/Users', user);
      if (!created) throw new ScimRequestError(204, 'POST', '/Users', 'empty response');
      return created;
    } catch (err) {
      if (err instanceof ScimRequestError && err.status === 409) {
        const existing = await this.findUserByUserName(user.userName);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /** Replace the platform-managed attributes of a user. */
  async replaceUser(id: string, user: ScimUserWrite): Promise<ScimUser | null> {
    return this.request<ScimUser>('PUT', `/Users/${encodeURIComponent(id)}`, user);
  }

  /** All groups on the app side (platform-managed ones carry an externalId). */
  async listGroups(): Promise<ScimGroup[]> {
    const list = await this.request<ScimListResponse<ScimGroup>>('GET', '/Groups?count=500');
    return list?.Resources ?? [];
  }

  async createGroup(group: ScimGroupWrite): Promise<ScimGroup | null> {
    return this.request<ScimGroup>('POST', '/Groups', group);
  }

  /** Full replace — displayName, membership, and role extension in one call. */
  async replaceGroup(id: string, group: ScimGroupWrite): Promise<ScimGroup | null> {
    return this.request<ScimGroup>('PUT', `/Groups/${encodeURIComponent(id)}`, group);
  }

  /** Delete a group; already-gone (404) counts as success. */
  async deleteGroup(id: string): Promise<void> {
    try {
      await this.request('DELETE', `/Groups/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ScimRequestError && err.status === 404) return;
      throw err;
    }
  }
}

export { SCIM_SCHEMAS, SCIM_ROLE_EXTENSION };
