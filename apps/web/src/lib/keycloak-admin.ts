import { env } from '@platform/config';
import { logger } from '@platform/logger';

function kcBaseUrl(): string {
  return env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_ISSUER.replace(/\/realms\/.*$/, '');
}

export async function getKeycloakAdminToken(): Promise<string> {
  const kcUrl = kcBaseUrl();
  const username = env.KEYCLOAK_ADMIN_USERNAME ?? 'admin';
  const password = env.KEYCLOAK_ADMIN_PASSWORD ?? '';

  const res = await fetch(`${kcUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username,
      password,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak admin token failed (${String(res.status)}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Keycloak admin token response missing access_token');
  return data.access_token;
}

interface KeycloakGroup {
  id: string;
  name: string;
}

export interface KeycloakGroupMember {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
}

// Top-level groups are named exactly after the platform role (see
// packages/auth/src/config.ts, which reads the flat `groups` claim).
async function findGroupIdByName(token: string, name: string): Promise<string | null> {
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const res = await fetch(
    `${kcUrl}/admin/realms/${realm}/groups?search=${encodeURIComponent(name)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Keycloak group lookup failed (${String(res.status)})`);
  const groups = (await res.json()) as KeycloakGroup[];
  return groups.find((g) => g.name === name)?.id ?? null;
}

export async function listGroupMembers(groupName: string): Promise<KeycloakGroupMember[]> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const groupId = await findGroupIdByName(token, groupName);
  if (!groupId) return [];

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/groups/${groupId}/members?max=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Keycloak group members lookup failed (${String(res.status)})`);
  const users = (await res.json()) as {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
  }[];
  return users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    enabled: u.enabled ?? true,
  }));
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const res = await fetch(
    `${kcUrl}/admin/realms/${realm}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Keycloak user lookup failed (${String(res.status)})`);
  const users = (await res.json()) as { id: string; email?: string }[];
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

export async function addUserToGroup(groupName: string, userId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const groupId = await findGroupIdByName(token, groupName);
  if (!groupId) throw new Error(`Keycloak group "${groupName}" does not exist`);

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak add-to-group failed (${String(res.status)}): ${text}`);
  }
}

export async function removeUserFromGroup(groupName: string, userId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const groupId = await findGroupIdByName(token, groupName);
  if (!groupId) throw new Error(`Keycloak group "${groupName}" does not exist`);

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak remove-from-group failed (${String(res.status)}): ${text}`);
  }
}

/**
 * Pushes the Riogentix connected app's configured branding API path onto the
 * "web" client's attributes, live, the moment an admin saves it in the
 * Connected Apps console — no separate "run the sync script" step. A manual
 * re-sync step is exactly what let the post-logout-redirect-uri fix silently
 * not apply across multiple git commits earlier tonight (see
 * apps/workers/src/provisioning/keycloak-sync.ts); a value this easy to
 * forget to re-sync isn't worth repeating that mistake for.
 *
 * This has to be a *client* attribute, not a realm attribute: Keycloak's
 * login-theme FreeMarker model exposes `client.attributes` (ClientBean has
 * getAttributes()) but has no realm-level equivalent (RealmBean doesn't
 * expose attributes at all) — see
 * infra/keycloak/themes/platform/login/template.ftl, which reads it back via
 * `${client.attributes.brandingApiPath}` to know where, on whatever tenant
 * host the visitor is on, to fetch branding from. Only the path is
 * client-level config; the domain is derived per request from the login
 * URL's redirect_uri query param.
 */
export async function syncBrandingApiPathToKeycloak(path: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/clients?clientId=web`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Keycloak client lookup failed (${String(res.status)})`);
  const clients = (await res.json()) as { id: string; attributes?: Record<string, string> }[];
  const client = clients[0];
  if (!client) throw new Error(`Keycloak client "web" not found in realm ${realm}`);

  if (client.attributes?.brandingApiPath === path) {
    logger.info({ path }, 'Keycloak web client brandingApiPath already up to date');
    return;
  }

  const update = await fetch(`${kcUrl}/admin/realms/${realm}/clients/${client.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...client,
      attributes: { ...client.attributes, brandingApiPath: path },
    }),
  });
  if (!update.ok) {
    const text = await update.text().catch(() => '');
    throw new Error(`Keycloak client attribute update failed (${String(update.status)}): ${text}`);
  }
  logger.info({ path }, 'Synced brandingApiPath to Keycloak web client');
}
