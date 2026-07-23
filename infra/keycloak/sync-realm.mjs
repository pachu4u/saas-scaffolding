#!/usr/bin/env node
/**
 * Pushes client config (redirectUris, webOrigins, attributes) from
 * realm-export.json into an already-running Keycloak realm.
 *
 * Keycloak's `--import-realm` only imports a realm the FIRST time its data
 * volume is created — once the realm exists, edits to realm-export.json are
 * silently ignored on every restart. That's why the same "fix signout" /
 * "fix redirect uri" change has landed in git multiple times without ever
 * taking effect: nothing re-applies the file to the live realm. Run this
 * after editing realm-export.json (or wire it into deploy) to actually push
 * the change.
 *
 * Usage: node infra/keycloak/sync-realm.mjs [container] [adminUser] [adminPass]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const container = process.argv[2] ?? 'keycloak';
const adminUser = process.argv[3] ?? process.env.KEYCLOAK_ADMIN ?? 'admin';
const adminPass = process.argv[4] ?? process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const realmFile = join(__dirname, 'realm-export.json');
const realm = JSON.parse(readFileSync(realmFile, 'utf8'));

function kcadm(args) {
  return execFileSync('docker', ['exec', container, '/opt/keycloak/bin/kcadm.sh', ...args], {
    encoding: 'utf8',
  });
}

kcadm([
  'config',
  'credentials',
  '--server',
  'http://localhost:8080',
  '--realm',
  'master',
  '--user',
  adminUser,
  '--password',
  adminPass,
]);

// Realm-level settings (currently just the login theme) — same "file alone
// doesn't apply to an existing realm" trap as client config, so push it the
// same way. The brandingApiPath value itself lives on the "web" client's
// attributes (see below, in the per-client loop), not here — Keycloak's
// login-theme FreeMarker model exposes client.attributes but has no realm
// attributes equivalent (see template.ftl for why).
{
  const sets = [];
  if (realm.loginTheme) sets.push('-s', `loginTheme=${realm.loginTheme}`);
  if (realm.accountTheme) sets.push('-s', `accountTheme=${realm.accountTheme}`);
  if (sets.length > 0) {
    kcadm(['update', `realms/${realm.realm}`, ...sets]);
    console.log(`synced realm ${realm.realm} (theme)`);
  }
}

for (const client of realm.clients ?? []) {
  const existing = JSON.parse(
    kcadm(['get', 'clients', '-r', realm.realm, '-q', `clientId=${client.clientId}`]),
  );
  if (existing.length === 0) {
    console.warn(
      `skip ${client.clientId}: not found in realm ${realm.realm} (needs full import, not sync)`,
    );
    continue;
  }
  const id = existing[0].id;
  const sets = [];
  if (client.redirectUris) sets.push('-s', `redirectUris=${JSON.stringify(client.redirectUris)}`);
  if (client.webOrigins) sets.push('-s', `webOrigins=${JSON.stringify(client.webOrigins)}`);
  for (const [key, value] of Object.entries(client.attributes ?? {})) {
    sets.push('-s', `attributes."${key}"="${value}"`);
  }
  if (sets.length === 0) continue;
  kcadm(['update', `clients/${id}`, '-r', realm.realm, ...sets]);
  console.log(`synced ${client.clientId}`);
}
