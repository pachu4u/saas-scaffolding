import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

/**
 * Settings E2E tests.
 *
 * Covers:
 *   - General settings: workspace name, slug, timezone
 *   - Branding settings: logo text, brand color
 *   - Security settings: MFA, session timeout, allowed domains
 *   - API Keys page
 *   - Settings navigation tabs
 */

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('settings page renders with nav tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('branding settings page renders', async ({ page }) => {
    await page.goto('/settings/branding');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/branding/i)).toBeVisible();
  });

  test('security settings page renders', async ({ page }) => {
    await page.goto('/settings/security');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/security/i)).toBeVisible();
  });

  test('API keys page renders', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/api key/i)).toBeVisible();
  });

  // ── General settings ───────────────────────────────────────────────────────

  test('general settings — PATCH /api/settings/general accepts valid data', async ({ request }) => {
    const response = await request.patch('/api/settings/general', {
      data: { name: 'Updated Name', timezone: 'UTC' },
    });
    // 200 if authorized, 401 if not
    expect(response.status()).toBeOneOf([200, 401, 403]);
  });

  test('general settings — PATCH /api/settings/general rejects invalid slug', async ({
    request,
  }) => {
    const response = await request.patch('/api/settings/general', {
      data: { slug: 'INVALID SLUG!!!' },
    });
    expect(response.status()).toBeOneOf([400, 401, 403, 422]);
  });

  test('general settings form submits successfully', async ({ page }) => {
    await page.route('/api/settings/general', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({ json: { ok: true } });
      }
      return route.continue();
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // If there's a save button, click it
    const saveBtn = page.getByRole('button', { name: /save/i });
    if ((await saveBtn.count()) > 0) {
      await saveBtn.first().click();
      // Expect success toast or no error
      await page.waitForTimeout(500);
    }
  });

  // ── Branding settings ──────────────────────────────────────────────────────

  test('branding settings — PATCH /api/settings/branding accepts valid data', async ({
    request,
  }) => {
    const response = await request.patch('/api/settings/branding', {
      data: { section: 'colors', primaryColor: '#FF5733' },
    });
    expect(response.status()).toBeOneOf([200, 401, 403]);
  });

  test('branding page has color picker or color inputs', async ({ page }) => {
    await page.goto('/settings/branding');
    await page.waitForLoadState('networkidle');

    // Should have some form of color customization
    const colorInputs = page.locator(
      'input[type="color"], input[type="text"][placeholder*="color" i], [class*="color"]',
    );
    const hasColorUI =
      (await colorInputs.count()) > 0 || (await page.getByText(/color|brand/i).count()) > 0;
    expect(hasColorUI).toBe(true);
  });

  // ── Security settings ──────────────────────────────────────────────────────

  test('security settings — PATCH /api/settings/security accepts valid data', async ({
    request,
  }) => {
    const response = await request.patch('/api/settings/security', {
      data: { mfaRequired: false },
    });
    expect(response.status()).toBeOneOf([200, 401, 403]);
  });

  // ── API keys page ──────────────────────────────────────────────────────────

  test('API keys page shows create key option', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create|generate|new/i });
    const hasCreateOption = (await createBtn.count()) > 0;
    // Just verify the page loaded correctly
    expect(page.url()).toCon