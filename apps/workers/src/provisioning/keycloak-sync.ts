import { env } from '@platform/config';
import { logger } from '@platform/logger';

function kcBaseUrl(): string {
  return env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_ISSUER.replace(/\/realms\/.*$/, '');
}

async function getAdminToken(): Promise<string> {
  const kcUrl = kcBaseUrl();
  const res = await fetch(`${kcUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: env.KEYCLOAK_ADMIN_USERNAME ?? 'admin',
      password: env.KEYCLOAK_ADMIN_PASSWORD ?? '',
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

interface KeycloakClient {
  id: string;
  redirectUris?: string[];
  webOrigins?: string[];
  attributes?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Keycloak only matches a trailing `*` as a path suffix on an otherwise
 * literal host — `https://*.techhanker.com/*` never actually matches a
 * tenant subdomain, for either login redirects or post-logout redirects.
 * That gap caused sign-in/sign-out to silently break for every tenant
 * despite repeated fixes to the platform-level wildcard entry (see
 * f582c94, efe18cb, a8b245e). Each tenant needs its own explicit entry on
 * the `web` client, so this runs on every provision (idempotent — safe on
 * retries) instead of relying on a realm-export.json wildcard.
 */
export async function registerTenantWithKeycloak(host: string): Promise<void> {
  const kcUrl = kcBaseUrl();
  const realm = env.KEYCLOAK_REALM;
  const token = await getAdminToken();

  const res = await fetch(`${kcUrl}/admin/realms/${realm}/clients?clientId=web`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Keycloak client lookup failed (${String(res.status)})`);
  const clients = (await res.json()) as KeycloakClient[];
  const client = clients[0];
  if (!client) throw new Error(`Keycloak client "web" not found in realm ${realm}`);

  const redirectEntry = `https://${host}/*`;
  const originEntry = `https://${host}`;
  const logoutEntry = `https://${host}/auth/signin`;

  const redirectUris = new Set(client.redirectUris ?? []);
  const webOrigins = new Set(client.webOrigins ?? []);
  const logoutUris = new Set(
    (client.attributes?.['post.logout.redirect.uris'] ?? '').split('##').filter(Boolean),
  );

  let changed = false;
  if (!redirectUris.has(redirectEntry)) {
    redirectUris.add(redirectEntry);
    changed = true;
  }
  if (!webOrigins.has(originEntry)) {
    webOrigins.add(originEntry);
    changed = true;
  }
  if (!logoutUris.has(logoutEntry)) {
    logoutUris.add(logoutEntry);
    changed = true;
  }
  if (!logoutUris.has(redirectEntry)) {
    logoutUris.add(redirectEntry);
    changed = true;
  }

  if (!changed) {
    logger.info({ host }, 'Keycloak web client already has tenant redirect/logout URIs');
    return;
  }

  const update = await fetch(`${kcUrl}/admin/realms/${realm}/clients/${client.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...client,
      redirectUris: [...redirectUris],
      webOrigins: [...webOrigins],
      attributes: {
        ...client.attributes,
        'post.logout.redirect.uris': [...logoutUris].join('##'),
      },
    }),
  });
  if (!update.ok) {
    const text = await update.text().catch(() => '');
    throw new Error(`Keycloak client update failed (${String(update.status)}): ${text}`);
  }
  logger.info({ host }, 'Registered tenant redirect/logout URIs with Keycloak');
}
