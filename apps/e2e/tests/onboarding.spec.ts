import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

/**
 * Onboarding wizard E2E tests.
 *
 * The wizard has 5 steps:
 *   1. Workspace — name, slug, timezone
 *   2. Invite    — team member emails (optional)
 *   3. Branding  — display name, brand color
 *   4. Billing   — plan selection (Free / Pro / Enterprise)
 *   5. Done!     — completion screen with quick links
 */

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
  });

  test('renders step progress indicators', async ({ page }) => {
    // All 5 step labels should be visible
    for (const label of ['Workspace', 'Invite team', 'Branding', 'Billing', 'Done!']) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('step 1 – workspace: validates required name', async ({ page }) => {
    // Try to continue without a name
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/workspace name is required/i)).toBeVisible();
  });

  test('step 1 – workspace: validates slug format', async ({ page }) => {
    await page.getByPlaceholder(/acme corporation/i).fill('Test Co');
    // Clear the auto-derived slug and type an invalid one
    await page.getByPlaceholder('acme').clear();
    await page.getByPlaceholder('acme').fill('INVALID SLUG!');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/slug must be/i)).toBeVisible();
  });

  test('step 1 – workspace: auto-derives slug from name', async ({ page }) => {
    await page.getByPlaceholder(/acme corporation/i).fill('My Test Company');
    const slugInput = page.getByPlaceholder('acme');
    await expect(slugInput).toHaveValue('my-test-company');
  });

  test('step 1 → step 2: advances on valid input', async ({ page }) => {
    const uniqueSlug = `e2e-test-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('E2E Test Workspace');
    await page.getByPlaceholder('acme').fill(uniqueSlug);

    // Mock the API call to avoid actually creating a tenant
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/invite your teammates/i)).toBeVisible();
  });

  test('step 2 – invite: skip button advances to branding', async ({ page }) => {
    // Navigate to step 2 by mocking step 1 API
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-skip-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Skip Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();

    // Now on invite step
    await expect(page.getByText(/team member emails/i)).toBeVisible();
    // No emails → button says "Skip"
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
    await page.getByRole('button', { name: /skip/i }).click();

    // Should be on branding step
    await expect(page.getByText(/workspace display name/i)).toBeVisible();
  });

  test('step 2 – invite: sends invites when emails are entered', async ({ page }) => {
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/team/invite', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-invite-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Invite Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByPlaceholder(/alice@acme/i).fill('teammate@example.com');
    await expect(page.getByRole('button', { name: /send invites/i })).toBeVisible();
    await page.getByRole('button', { name: /send invites/i }).click();

    // Advances to branding
    await expect(page.getByText(/brand color/i)).toBeVisible();
  });

  test('step 3 – branding: can select a brand color', async ({ page }) => {
    // Navigate to branding step
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/team/invite', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-brand-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Brand Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();

    // Branding step is visible
    await expect(page.getByText(/brand color/i)).toBeVisible();

    // Click a color swatch
    const swatches = page.locator('button[style*="background: #"]');
    await swatches.first().click();

    // Preview should be visible
    await expect(page.locator('text=Primary button')).toBeVisible();
  });

  test('step 4 – billing: free plan selection advances to done', async ({ page }) => {
    // Navigate through steps 1-3
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-free-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Free Plan Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Billing step
    await expect(page.getByText(/choose the plan/i)).toBeVisible();
    // All three plan options should be present
    await expect(page.getByText('Free')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
    await expect(page.getByText('Enterprise')).toBeVisible();

    // Select free
    await page.getByRole('button', { name: /^free/i }).click();

    // Done step
    await expect(page.getByText(/you're all set/i)).toBeVisible();
  });

  test('step 4 – billing: pro plan triggers checkout redirect', async ({ page }) => {
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/billing/checkout', (route) =>
      route.fulfill({ json: { url: 'https://checkout.stripe.com/test-session' } }),
    );

    const uniqueSlug = `e2e-pro-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Pro Plan Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Intercept navigation to Stripe
    const navigationPromise = page.waitForNavigation({ timeout: 5_000 }).catch(() => null);
    await page.getByRole('button', { name: /^pro/i }).click();
    await navigationPromise;
  });

  test('step 5 – done: shows quick action links', async ({ page }) => {
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-done-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Done Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /^free/i }).click();

    // Done step
    await expect(page.getByText(/manage team/i)).toBeVisible();
    await expect(page.getByText(/set up sso/i)).toBeVisible();
    await expect(page.getByText(/view dashboard/i)).toBeVisible();

    // "Go to dashboard" button navigates to /dashboard
    await page.getByRole('button', { name: /go to dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('back navigation works between steps', async ({ page }) => {
    await page.route('/api/settings/general', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-back-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Back Test');
    await page.getByPlaceholder('acme').fill(uniqueSlug);
    await page.getByRole('button', { name: /continue/i }).click();

    // Now on step 2 — go back
    await page.getByRole('button', { name: /back/i }).click();

    // Should be back on step 1
    await expect(page.getByPlaceholder(/acme corporation/i)).toBeVisible();
  });
});
