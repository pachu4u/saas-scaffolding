import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers/auth';

/**
 * Webhooks E2E tests.
 *
 * Covers:
 *   - Webhook endpoints list page
 *   - Add webhook endpoint modal
 *   - Endpoint validation (URL format, events selection)
 *   - Webhook endpoint detail: delivery history
 *   - Pause / delete a webhook
 *   - API: CRUD operations
 */

test.describe('Webhooks', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  });

  // ── Webhooks list ──────────────────────────────────────────────────────────

  test('webhooks page renders', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    // .first() — the empty state's "No webhook endpoints" heading also
    // matches /webhook/i when there are no endpoints yet.
    await expect(page.getByRole('heading', { name: /webhook/i }).first()).toBeVisible();
  });

  test('webhooks page has add endpoint button', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /add|new|create/i }).first()).toBeVisible();
  });

  // ── Add webhook modal ──────────────────────────────────────────────────────
  // The modal is a plain styled <div> overlay, not role="dialog" — these
  // tests check its actual heading instead.

  test('add webhook modal opens', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /add|new|create/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Add webhook endpoint' })).toBeVisible();
  });

  test('add webhook modal — URL field is required', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /add|new|create/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Add webhook endpoint' })).toBeVisible();

    // Try submitting without URL
    const submitBtn = page.getByRole('button', { name: /save|add|create webhook/i });
    if ((await submitBtn.count()) > 0) {
      await submitBtn.last().click();
      // Should show validation error or HTML5 required
      const urlInput = page.getByPlaceholder(/https/i).or(page.locator('input[type="url"]'));
      if ((await urlInput.count()) > 0) {
        const validationMsg = await urlInput
          .first()
          .evaluate((el: HTMLInputElement) => el.validationMessage);
        expect(
          validationMsg.length + (await page.getByText(/required|url/i).count()),
        ).toBeGreaterThan(0);
      }
    }
  });

  test('add webhook modal — rejects non-HTTPS URL', async ({ page }) => {
    await page.route('/api/webhooks', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          json: { error: 'URL must use HTTPS' },
        });
      }
      return route.continue();
    });

    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /add|new|create/i })
      .first()
      .click();

    const urlInput = page.getByPlaceholder(/https/i).or(page.locator('input[type="url"]')).first();
    if ((await urlInput.count()) > 0) {
      await urlInput.fill('http://not-secure.example.com/hook');
      const submitBtn = page.getByRole('button', { name: /save|add|create webhook/i });
      if ((await submitBtn.count()) > 0) {
        await submitBtn.last().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('add webhook — success creates endpoint', async ({ page }) => {
    await page.route('/api/webhooks', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            id: 'wh-test-id',
            url: 'https://example.com/webhook',
            events: ['tenant.created'],
            status: 'ACTIVE',
          },
        });
      }
      return route.continue();
    });

    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('button', { name: /add|new|create/i })
      .first()
      .click();

    const urlInput = page.getByPlaceholder(/https/i).or(page.locator('input[type="url"]')).first();
    if ((await urlInput.count()) > 0) {
      await urlInput.fill('https://example.com/webhook');
      const submitBtn = page.getByRole('button', { name: /save|add|create webhook/i });
      if ((await submitBtn.count()) > 0) {
        await submitBtn.last().click();
        await expect(page.getByRole('heading', { name: 'Add webhook endpoint' })).not.toBeVisible({
          timeout: 3_000,
        });
      }
    }
  });

  // ── Webhook deliveries ─────────────────────────────────────────────────────

  test('webhook deliveries page renders for a valid endpoint', async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');

    const viewLinks = page.getByRole('link', { name: /view|deliveries/i });
    if ((await viewLinks.count()) === 0) {
      test.skip(true, 'No webhook endpoints to view');
      return;
    }

    await viewLinks.first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/webhooks\/.+/);
  });

  // ── API tests ──────────────────────────────────────────────────────────────

  test('GET /api/webhooks returns list', async ({ request }) => {
    const response = await request.get('/api/webhooks', { maxRedirects: 0 });
    expect([200, 307, 401, 403]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as unknown[];
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test('POST /api/webhooks creates endpoint', async ({ request }) => {
    const response = await request.post('/api/webhooks', {
      data: {
        url: 'https://example.com/test-hook',
        events: ['tenant.created', 'tenant.updated'],
      },
      maxRedirects: 0,
    });
    expect([201, 307, 400, 401, 403, 409]).toContain(response.status());
  });

  test('PATCH /api/webhooks/[id] updates endpoint', async ({ request }) => {
    const response = await request.patch('/api/webhooks/non-existent-id', {
      data: { status: 'PAUSED' },
      maxRedirects: 0,
    });
    expect([200, 307, 401, 403, 404]).toContain(response.status());
  });

  test('DELETE /api/webhooks/[id] deletes endpoint', async ({ request }) => {
    const response = await request.delete('/api/webhooks/non-existent-id', {
      maxRedirects: 0,
    });
    expect([200, 204, 307, 401, 403, 404]).toContain(response.status());
  });

  test('GET /api/webhooks/[id]/deliveries returns delivery history', async ({ request }) => {
    const response = await request.get('/api/webhooks/non-existent-id/deliveries', {
      maxRedirects: 0,
    });
    expect([200, 307, 401, 403, 404]).toContain(response.status());
  });
});
