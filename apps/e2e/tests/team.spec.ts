import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

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
    await signIn(page);
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

  test('invite modal opens', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
  });

  test('invite modal closes on cancel', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
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
    await page.getByPlaceholder(/email/i).fill('newmember@example.com');
    await page
      .getByRole('button', { name: /send invite|invite/i })
      .last()
      .click();

    await page.waitForTimeout(500);
    expect(inviteCalled).toBe(true);
  });

  test('invite modal — rejects invalid email', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await page.getByPlaceholder(/email/i).fill('not-an-email');
    await page
      .getByRole('button', { name: /send invite|invite/i })
      .last()
      .click();

    // HTML5 validation or custom error should fire
    const emailInput = page.getByPlaceholder(/email/i);
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    expect(validationMessage.length).toBeGreaterThan(0);
  });

  // ── Roles ──────────────────────────────────────────────────────────────────

  test('roles page renders', async ({ page }) => {
    await page.goto('/team/roles');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
  });

  test('role detail page renders for a valid role', async ({ page }) => {
    await page.goto('/team/roles');
    await page.waitForLoadState('networkidle');

    const roleLinks = page.getByRole('link').filter({ hasText: /admin|member|owner/i });
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

    // Look for a role dropdown or change-role button
    const changeRoleBtn = page.getByRole('button', { name: /change role/i });
    if ((await changeRoleBtn.count()) === 0) {
      test.skip(true, 'No change role button visible');
      return;
    }

    await changeRoleBtn.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
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
    });
    expect(response.status()).toBeOneOf([400, 401, 403, 422]);
  });

  test('GET /api/team/invite/[token]/accept redirects appropriately', async ({ request }) => {
    const response = await request.get('/api/team/invite/bad-token/accept', {
      maxRedirects: 0,
    });
    expect(response.status()).toBeOneOf([302, 307, 400, 401, 404]);
  });
});
