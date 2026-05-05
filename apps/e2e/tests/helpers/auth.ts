import { type Page, type BrowserContext } from '@playwright/test';

export const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@platform.test';
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'admin';

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'user@acme.test';
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'password';

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

  // Wait for redirect to Keycloak login page
  await page.waitForURL(/auth\.lvh\.me|keycloak/);

  // Fill Keycloak login form
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(/app\.lvh\.me/);
  await page.waitForLoadState('networkidle');
}

/**
 * Signs out the current user.
 */
export async function signOut(page: Page) {
  // Click user menu / avatar
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: /sign out|log out/i }).click();
  await page.waitForURL(/auth\.lvh\.me|\/auth\/signin/);
}

/**
 * Saves authenticated browser state to a file for session reuse.
 */
export async function saveAuthState(context: BrowserContext, path: string) {
  await context.storageState({ path });
}
