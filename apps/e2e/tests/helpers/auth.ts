import { type Page, type BrowserContext } from '@playwright/test';

// Real seeded demo accounts (see infra/keycloak/realm-export.json + packages/db/src/seed.ts).
export const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@platform.test';
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'platform123';

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'alice@acme.test';
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'alice123';

/**
 * Signs in via the Keycloak-backed auth flow.
 * Stores the session state in the browser context for reuse.
 */
export async function signIn(
  page: Page,
  email: string = TEST_ADMIN_EMAIL,
  password: string = TEST_ADMIN_PASSWORD,
) {
  await page.goto('/auth/signin');

  // The sign-in page requires clicking "Continue with SSO" (a Server Action
  // form submit) — it does not auto-redirect to Keycloak on page load.
  await page.getByRole('button', { name: /continue with sso/i }).click();

  // Wait for redirect to Keycloak login page
  await page.waitForURL(/auth\.lvh\.me|keycloak/);

  // Fill Keycloak login form. The password field's label is "Password", but
  // a loose /password/i match also catches the "Show password" toggle
  // button's aria-label, so match the label text exactly.
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(/app\.lvh\.me/);
  await page.waitForLoadState('networkidle');
}

/**
 * Signs out the current user.
 */
export async function signOut(page: Page) {
  // Sidebar footer has a direct "Sign out" link — no dropdown/menu involved.
  await page.getByRole('link', { name: /sign out/i }).click();
  await page.waitForURL(/auth\.lvh\.me|\/auth\/signin/);
}

/**
 * Saves authenticated browser state to a file for session reuse.
 */
export async function saveAuthState(context: BrowserContext, path: string) {
  await context.storageState({ path });
}
