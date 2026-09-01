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

/**
 * Creates a Keycloak user with no credentials and a required UPDATE_PASSWORD
 * action, for platform admins adding a bare account (no tenant, no role
 * binding) via /admin/users. The user sets their own password via the
 * execute-actions email rather than the admin choosing one for them.
 */
export async function createPendingKeycloakUser(email: string, name?: string): Promise<string> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  const [firstName, ...rest] = (name ?? email).trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      username: email.toLowerCase(),
      email: email.toLowerCase(),
      firstName: firstName ?? '',
      lastName,
      enabled: true,
      emailVerified: false,
      requiredActions: ['UPDATE_PASSWORD'],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak user creation failed (${String(res.status)}): ${text}`);
  }

  // 201 Location header: .../admin/realms/{realm}/users/{userId}
  const location = res.headers.get('Location') ?? '';
  const kcUserId = location.split('/').pop();
  if (!kcUserId)
    throw new Error('Keycloak user created but could not extract user ID from Location header');
  return kcUserId;
}

/**
 * Creates a Keycloak user with a real, immediately-usable password — for a
 * team member accepting an invite, who proves eligibility via the invite's
 * signed token rather than Keycloak's own (disabled, registrationAllowed:
 * false) self-registration. Mirrors /api/signup's createKeycloakUser.
 */
export async function createKeycloakUserWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<string> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  const [firstName, ...rest] = (name ?? email).trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      username: email.toLowerCase(),
      email: email.toLowerCase(),
      firstName: firstName ?? '',
      lastName,
      enabled: true,
      emailVerified: true, // already proven by receiving the invite email itself
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak user creation failed (${String(res.status)}): ${text}`);
  }

  const location = res.headers.get('Location') ?? '';
  const kcUserId = location.split('/').pop();
  if (!kcUserId)
    throw new Error('Keycloak user created but could not extract user ID from Location header');
  return kcUserId;
}

export async function deleteKeycloakUser(kcUserId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  await fetch(`${kcUrl}/admin/realms/${realm}/users/${kcUserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Flips a user's emailVerified flag once they've clicked our own verification
 * link (see /verify-email/[token]) -- signup creates the Keycloak user with
 * emailVerified: false and provisioning is gated on this, not on Keycloak's
 * own VERIFY_EMAIL required action (keeps the verification email on the
 * same MailOut/Resend path as every other transactional email instead of
 * depending on the realm's separate, currently-unconfigured SMTP settings).
 */
export async function markKeycloakEmailVerified(kcUserId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/users/${kcUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emailVerified: true }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak emailVerified update failed (${String(res.status)}): ${text}`);
  }
}

/**
 * Triggers Keycloak's own "execute actions" email (via the realm's configured
 * SMTP) so a newly-created pending user can set their password. Best-effort —
 * callers should treat failure as non-fatal since SMTP may be unconfigured in
 * some environments.
 */
export async function sendKeycloakSetPasswordEmail(kcUserId: string): Promise<void> {
  const token = await getKeycloakAdminToken();
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;

  const res = await fetch(
    `${kcUrl}/admin/realms/${realm}/users/${kcUserId}/execute-actions-email?lifespan=259200`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(['UPDATE_PASSWORD']),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak execute-actions-email failed (${String(res.status)}): ${text}`);
  }
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
