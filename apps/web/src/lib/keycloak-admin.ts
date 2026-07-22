import { env } from '@platform/config';

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
