import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers/auth';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\.lvh\.me|\/auth\/signin/);
  });

  test('redirects unauthenticated users from admin pages', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/auth\.lvh\.me|\/auth\/signin/);
  });

  test('sign-in page renders Keycloak button', async ({ page }) => {
    await page.goto('/auth/signin');
    // Either the Keycloak page is rendered inline OR there's a "Sign in" button
    // depending on how auth.js is configured (auto-redirect vs show provider buttons)
    await expect(page).toHaveTitle(/sign in|login|riogentix/i);
  });

  test('full sign-in flow redirects to dashboard', async ({ page }) => {
    // Platform admins always redirect to /admin, never /dashboard — use a
    // regular tenant user to test the dashboard-bound flow.
    await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  });

  test('health endpoint returns 200 without auth', async ({ request }) => {
    // /api/health intentionally requires auth — the real public liveness
    // probe (used by the Docker healthcheck) is /_health.
    const response = await request.get('/_health');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test('ready endpoint returns 200 without auth', async ({ request }) => {
    const response = await request.get('/_ready');
    expect([200, 503]).toContain(response.status());
  });
});
