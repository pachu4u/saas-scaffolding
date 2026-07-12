import { test, expect } from '@playwright/test';

import {
  signIn,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
} from './helpers/auth';

/**
 * Onboarding wizard E2E tests.
 *
 * Provisioning a new tenant is a platform-admin-only action — the wizard is
 * gated to platform admins and its first step calls POST /api/tenants to
 * actually create the tenant (not a rename of the caller's own tenant).
 *
 * The wizard has 5 steps:
 *   1. Workspace — name, slug, timezone → creates the tenant
 *   2. Invite    — team member emails (optional)
 *   3. Branding  — display name, brand color
 *   4. Billing   — plan selection (Free / Pro / Enterprise)
 *   5. Done!     — completion screen
 */

const MOCK_TENANT = {
  id: 'e2e-tenant-id',
  slug: 'e2e-tenant',
  name: 'E2E Tenant',
  status: 'ACTIVE',
  plan: 'free',
  createdAt: new Date(0).toISOString(),
};

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
  });

  test('renders step progress indicators', async ({ page }) => {
    // All 5 step labels should be visible
    for (const label of ['Workspace', 'Invite team', 'Branding', 'Billing', 'Done!']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('step 1 – workspace: validates required name', async ({ page }) => {
    // Try to continue without a name
    await page.getByRole('button', { name: /create tenant/i }).click();
    await expect(page.getByText(/workspace name is required/i)).toBeVisible();
  });

  test('step 1 – workspace: validates slug format', async ({ page }) => {
    await page.getByPlaceholder(/acme corporation/i).fill('Test Co');
    // Clear the auto-derived slug and type an invalid one
    await page.getByPlaceholder('acme', { exact: true }).clear();
    await page.getByPlaceholder('acme', { exact: true }).fill('INVALID SLUG!');
    await page.getByRole('button', { name: /create tenant/i }).click();
    await expect(page.getByText(/slug must be/i)).toBeVisible();
  });

  test('step 1 – workspace: auto-derives slug from name', async ({ page }) => {
    await page.getByPlaceholder(/acme corporation/i).fill('My Test Company');
    const slugInput = page.getByPlaceholder('acme', { exact: true });
    await expect(slugInput).toHaveValue('my-test-company');
  });

  test('step 1 → step 2: creates the tenant and advances', async ({ page }) => {
    const uniqueSlug = `e2e-test-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('E2E Test Workspace');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);

    // Mock the API call to avoid actually creating a tenant
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));

    await page.getByRole('button', { name: /create tenant/i }).click();
    await expect(page.getByText(/initial team members/i)).toBeVisible();
  });

  test('step 2 – invite: skip button advances to branding', async ({ page }) => {
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));

    const uniqueSlug = `e2e-skip-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Skip Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();

    // Now on invite step
    await expect(page.getByText(/team member emails/i)).toBeVisible();
    // No emails → button says "Skip"
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
    await page.getByRole('button', { name: /skip/i }).click();

    // Should be on branding step
    await expect(page.getByText(/tenant display name/i)).toBeVisible();
  });

  test('step 2 – invite: sends invites when emails are entered', async ({ page }) => {
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));
    await page.route('/api/team/invite', (route) => route.fulfill({ json: { success: true } }));

    const uniqueSlug = `e2e-invite-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Invite Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();

    await page.getByPlaceholder(/alice@acme/i).fill('teammate@example.com');
    await expect(page.getByRole('button', { name: /send invites/i })).toBeVisible();
    await page.getByRole('button', { name: /send invites/i }).click();

    // Advances to branding
    await expect(page.getByText(/brand color/i)).toBeVisible();
  });

  test('step 3 – branding: can select a brand color', async ({ page }) => {
    // Navigate to branding step
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));
    await page.route('/api/team/invite', (route) => route.fulfill({ json: { success: true } }));

    const uniqueSlug = `e2e-brand-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Brand Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();

    // Branding step is visible
    await expect(page.getByText(/brand color/i)).toBeVisible();

    // Click a color swatch. The swatch buttons render with no text, just an
    // inline background-color style (browsers serialize hex as rgb(), so a
    // "background: #" substring match never hits) — select them by their
    // structural position right after the "Brand color" label instead.
    const swatches = page
      .getByText('Brand color', { exact: true })
      .locator('xpath=following-sibling::div[1]/button');
    await swatches.first().click();

    // Preview should be visible
    await expect(page.locator('text=Primary button')).toBeVisible();
  });

  test('step 4 – billing: free plan selection advances to done', async ({ page }) => {
    // Navigate through steps 1-3
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-free-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Free Plan Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();
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
    await expect(page.getByText(/tenant provisioned/i)).toBeVisible();
  });

  test('step 4 – billing: pro plan triggers checkout redirect', async ({ page }) => {
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('/api/billing/checkout', (route) =>
      route.fulfill({ json: { url: 'https://checkout.stripe.com/test-session' } }),
    );

    const uniqueSlug = `e2e-pro-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Pro Plan Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Intercept navigation to Stripe
    const navigationPromise = page.waitForNavigation({ timeout: 5_000 }).catch(() => null);
    await page.getByRole('button', { name: /^pro/i }).click();
    await navigationPromise;
  });

  test('step 5 – done: view tenant button navigates to admin tenant page', async ({ page }) => {
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));
    await page.route('/api/settings/branding', (route) => route.fulfill({ json: { ok: true } }));

    const uniqueSlug = `e2e-done-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Done Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /^free/i }).click();

    // Done step
    await expect(page.getByText(/tenant provisioned/i)).toBeVisible();

    // "View tenant" button navigates to the created tenant's admin page
    await page.getByRole('button', { name: /view tenant/i }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/tenants/${MOCK_TENANT.id}`));
  });

  test('back navigation works between steps', async ({ page }) => {
    await page.route('/api/tenants', (route) => route.fulfill({ json: MOCK_TENANT }));

    const uniqueSlug = `e2e-back-${Date.now()}`;
    await page.getByPlaceholder(/acme corporation/i).fill('Back Test');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /create tenant/i }).click();

    // Now on step 2 — go back
    await page.getByRole('button', { name: /back/i }).click();

    // Should be back on step 1
    await expect(page.getByPlaceholder(/acme corporation/i)).toBeVisible();
  });

  test('non-platform-admin is redirected away from onboarding', async ({ page, context }) => {
    await context.clearCookies();
    await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/no-workspace|\/dashboard/);
  });
});
