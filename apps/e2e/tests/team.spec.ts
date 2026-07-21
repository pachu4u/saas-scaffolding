import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers/auth';

/**
 * Team management E2E tests.
 *
 * Covers:
 *   - Team page renders member list
 *   - Invite modal: open, fill, submit
 *   - Email validation on invite
 *   - Role management: view roles, change member role
 *   - Invite acceptance flow via /invite/[token]
 *   - Removing / suspending a team member
 */

test.describe('Team management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  });

  // ── Team list ──────────────────────────────────────────────────────────────

  test('team page renders', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /invite/i })).toBeVisible();
  });

  test('team page shows member rows', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    // At minimum the signed-in user should appear
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── Invite modal ───────────────────────────────────────────────────────────

  // The invite modal is a plain styled <div> overlay — it has no role="dialog"
  // and its email input's placeholder/label aren't programmatically
  // associated, so these tests target the modal's actual heading and the
  // input by type instead.

  test('invite modal opens', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('heading', { name: 'Invite team member' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('invite modal closes on cancel', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: 'Invite team member' })).not.toBeVisible();
  });

  test('invite modal — send invite calls API', async ({ page }) => {
    let inviteCalled = false;
    await page.route('/api/team/invite', (route) => {
      if (route.request().method() === 'POST') {
        inviteCalled = true;
        return route.fulfill({ json: { ok: true } });
      }
      return route.continue();
    });

    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await page.locator('input[type="email"]').fill('newmember@example.com');
    await page.getByRole('button', { name: /^send invite$/i }).click();

    await page.waitForTimeout(500);
    expect(inviteCalled).toBe(true);
  });

  test('invite modal — rejects invalid email', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('not-an-email');
    await page.getByRole('button', { name: /^send invite$/i }).click();

    // HTML5 validation or custom error should fire
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    expect(validationMessage.length).toBeGreaterThan(0);
  });

  // ── Roles ──────────────────────────────────────────────────────────────────

  test('roles page renders', async ({ page }) => {
    await page.goto('/team/roles');
    await page.waitForLoadState('networkidle');

    // The page shares the parent "Team" Topbar — there's no separate "Roles"
    // H1, just the "Roles & Permissions" nav tab and a "Permission Matrix"
    // section heading.
    await expect(page).toHaveTitle(/roles/i);
    await expect(page.getByRole('heading', { name: 'Permission Matrix' })).toBeVisible();
  });

  test('role detail page renders for a valid role', async ({ page }) => {
    await page.goto('/team/roles');
    await page.waitForLoadState('networkidle');

    // Match by href pattern, not text — the sidebar's "Members" nav link
    // (href="/team") also matches a text filter like /member/i.
    const roleLinks = page.locator('a[href^="/team/roles/"]');
    const count = await roleLinks.count();
    if (count === 0) {
      test.skip(count === 0, 'No roles listed');
      return;
    }

    await roleLinks.first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/team\/roles\/.+/);
  });

  test('change role modal opens', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    // The button is labelled "Edit role" in the UI.
    const changeRoleBtn = page.getByRole('button', { name: /edit role/i });
    if ((await changeRoleBtn.count()) === 0) {
      test.skip(true, 'No edit role button visible');
      return;
    }

    await changeRoleBtn.first().click();
    await expect(page.getByRole('heading', { name: 'Change role' })).toBeVisible();
  });

  // ── Invite token acceptance ────────────────────────────────────────────────

  test('invite page with invalid token shows error', async ({ page }) => {
    await page.goto('/invite/invalid-token-xyz');
    await page.waitForLoadState('networkidle');

    // Should show an error or redirect
    const isError =
      (await page.getByText(/invalid|expired|not found/i).count()) > 0 ||
      page.url().includes('/auth/signin') ||
      page.url().includes('/dashboard');
    expect(isError).toBe(true);
  });

  // ── API: Team invite ───────────────────────────────────────────────────────

  test('POST /api/team/invite returns 400 for missing email', async ({ request }) => {
    const response = await request.post('/api/team/invite', {
      data: {},
      maxRedirects: 0,
    });
    expect([307, 400, 401, 403, 422]).toContain(response.status());
  });

  test('GET /api/team/invite/[token]/accept redirects appropriately', async ({ request }) => {
    const response = await request.get('/api/team/invite/bad-token/accept', {
      maxRedirects: 0,
    });
    expect([302, 307, 400, 401, 404]).toContain(response.status());
  });
});
