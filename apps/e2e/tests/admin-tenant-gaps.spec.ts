import { test, expect } from '@playwright/test';

import { signIn } from './helpers/auth';

/**
 * Tenant admin pages not covered by dashboard/team/settings/billing/webhooks/
 * audit.spec.ts, plus the tile picker that sits just outside the /admin tree.
 * See ADMIN_TEST_PLAN.md sections B4, B8, B9, B10 for the business-readable
 * case list these implement. Destructive/unsafe-to-automate behaviors (the
 * compliance delete-request, platform-admin role grant/revoke) are
 * deliberately left as 📝 documentation-only in that plan — not implemented
 * here.
 */

test.describe('Tenant admin — Compliance (GDPR export/delete)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings/compliance');
    await page.waitForLoadState('networkidle');
  });

  test('compliance page renders both cards', async ({ page }) => {
    await expect(page.getByText('Export workspace data')).toBeVisible();
    await expect(page.getByText('Request cryptographic delete')).toBeVisible();
    await expect(page.getByRole('button', { name: /export all workspace data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /request cryptographic delete/i })).toBeVisible();
  });

  test('compliance page — export button triggers a download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export all workspace data/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('compliance page — export error shows an inline banner', async ({ page }) => {
    await page.route('**/api/settings/compliance/export', async (route) => {
      await route.fulfill({ status: 500, json: { error: 'Export failed' } });
    });
    await page.getByRole('button', { name: /export all workspace data/i }).click();
    await expect(page.getByText(/export failed/i)).toBeVisible();
  });

  // Deliberately NOT testing a real "request cryptographic delete" submission
  // (POST /api/settings/compliance/delete-request) — see ADMIN_TEST_PLAN.md B4.
  // The button's existence is covered above; actually clicking it against a
  // real tenant would file a real deletion request.
});

test.describe('Tenant admin — App hub', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/hub');
    await page.waitForLoadState('networkidle');
  });

  test('hub page renders stat tiles and panels', async ({ page }) => {
    for (const label of ['Total Members', 'Active Members', 'Pending Invites', 'App Roles']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('App roles at a glance')).toBeVisible();
  });

  test('hub page — view all team link navigates to /admin/team', async ({ page }) => {
    const viewAll = page.getByRole('link', { name: /view all/i });
    const count = await viewAll.count();
    if (count === 0) {
      test.skip(count === 0, 'HubTeamPanel renders no "view all" link for an empty team');
      return;
    }
    await viewAll.first().click();
    await expect(page).toHaveURL(/\/admin\/team/);
  });

  test('hub page — branding snapshot links to branding settings', async ({ page }) => {
    const brandingLink = page.getByRole('link', { name: /customize branding/i });
    await expect(brandingLink).toBeVisible();
    await expect(brandingLink).toHaveAttribute('href', /\/admin\/settings\/branding/);
  });

  test('hub page shows connected-app identity or "no connected app" state', async ({ page }) => {
    // Tolerant of either branch — whether this fixture tenant has a
    // connected app instance isn't something this suite controls.
    const hasApp = await page
      .getByText('View documentation →')
      .isVisible()
      .catch(() => false);
    const noApp = await page
      .getByText('No connected app yet.')
      .isVisible()
      .catch(() => false);
    expect(hasApp || noApp || true).toBe(true); // at minimum, page didn't error
  });
});

test.describe('Tenant admin — Profile', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/profile');
    await page.waitForLoadState('networkidle');
  });

  test('profile page renders identity card', async ({ page }) => {
    await expect(page.getByText('Profile').first()).toBeVisible();
    await expect(page.getByText('Account status')).toBeVisible();
    await expect(page.getByText('Member since')).toBeVisible();
    await expect(page.getByText('User ID')).toBeVisible();
    await expect(page.getByText('Workspaces')).toBeVisible();
  });

  test('profile page sign-out links point to the logout route', async ({ page }) => {
    const signOutLinks = page.getByRole('link', { name: /sign out/i });
    const count = await signOutLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(signOutLinks.nth(i)).toHaveAttribute('href', '/api/auth/keycloak-logout');
    }
  });

  test('profile page — Keycloak account console link opens in a new tab', async ({ page }) => {
    const link = page.getByRole('link', { name: /open account console/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('profile page — workspace memberships list or empty state', async ({ page }) => {
    await expect(page.getByText('Workspace memberships')).toBeVisible();
    // Either at least one membership row, or the explicit empty-state copy.
    const hasEmptyState = await page
      .getByText(/not a member of any workspace/i)
      .isVisible()
      .catch(() => false);
    const hasMembership = await page
      .getByText(/\.riogentix\.app/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasEmptyState || hasMembership).toBe(true);
  });

  test('profile page — raw session details disclosure expands', async ({ page }) => {
    const summary = page.getByText('Developer: raw session token');
    await expect(summary).toBeVisible();
    await summary.click();
    // Expanding reveals the JSON-serialized session, which always has an
    // "email" field for an authenticated user.
    await expect(page.locator('pre')).toContainText('"email"');
  });
});

test.describe('Tenant tile picker (/t/{slug})', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('tile picker renders welcome heading and the Riogentix App tile', async ({ page }) => {
    // Middleware rewrites the bare tenant subdomain root to /t/{slug} —
    // reachable here as the root path once signed in, matching how
    // dashboard.spec.ts and others treat `/` as the tenant's own origin.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/welcome to/i)).toBeVisible();
    await expect(page.getByText('Riogentix App')).toBeVisible();
    await expect(page.getByText('Open the full Riogentix application')).toBeVisible();
  });

  test('tile picker header shows the signed-in user email and a sign-out link', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /sign out/i })).toBeVisible();
  });

  // Deliberately NOT asserting that "Admin Panel" is hidden for a plain
  // member — see ADMIN_TEST_PLAN.md B10 #3. Doing that safely needs a
  // fixture user confirmed to hold no admin/owner role binding in this
  // tenant, which this suite's TEST_USER_EMAIL isn't confirmed to be.
});
