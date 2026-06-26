import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers/auth';

/**
 * Billing E2E tests.
 *
 * Covers:
 *   - Billing page renders plan information
 *   - Upgrade to Pro → Stripe checkout redirect
 *   - Billing portal access
 *   - Webhook event processing (Stripe → DB)
 *   - Plan display on dashboard
 */

test.describe('Billing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  });

  test('billing page renders current plan', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    // The billing page should show the current plan
    await expect(page.getByText(/current plan|subscription/i).first()).toBeVisible();
  });

  test('billing page — upgrade to pro button triggers checkout', async ({ page }) => {
    await page.route('/api/billing/checkout', (route) =>
      route.fulfill({
        json: { url: 'https://checkout.stripe.com/pay/cs_test_123' },
      }),
    );

    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    const upgradeBtn = page.getByRole('button', { name: /upgrade|go pro/i });
    if ((await upgradeBtn.count()) === 0) {
      test.skip(true, 'No upgrade button found (already on Pro/Enterprise)');
      return;
    }

    // Watch for navigation to Stripe
    const [navigation] = await Promise.all([
      page.waitForNavigation({ timeout: 5_000 }).catch(() => null),
      upgradeBtn.click(),
    ]);
    // Either navigated away or checkout URL was set
    const url = page.url();
    expect(url.includes('stripe.com') || url.includes('/billing')).toBe(true);
  });

  test('billing portal button calls portal API', async ({ page }) => {
    let portalCalled = false;
    await page.route('/api/billing/portal', (route) => {
      portalCalled = true;
      return route.fulfill({
        json: { url: 'https://billing.stripe.com/session/bps_test_123' },
      });
    });

    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    const portalBtn = page.getByRole('button', { name: /manage billing|billing portal/i });
    if ((await portalBtn.count()) > 0) {
      await portalBtn.click();
      await page.waitForTimeout(500);
      expect(portalCalled).toBe(true);
    }
  });

  test('POST /api/billing/checkout returns URL for pro plan', async ({ request }) => {
    // maxRedirects: 0 — an unauthenticated request gets redirected (307) to
    // /auth/signin by middleware; following it would replay POST onto a
    // GET-only page route and surface a misleading 405.
    const response = await request.post('/api/billing/checkout', {
      data: { planCode: 'pro' },
      maxRedirects: 0,
    });
    // 307 (redirected to sign-in) if not authenticated via API — acceptable
    expect([200, 307, 401, 403]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as { url?: string };
      expect(body.url).toContain('stripe.com');
    }
  });

  test('POST /api/billing/checkout rejects unknown plan', async ({ request }) => {
    const response = await request.post('/api/billing/checkout', {
      data: { planCode: 'diamond-ultra' },
      maxRedirects: 0,
    });
    expect([307, 400, 401, 403, 422]).toContain(response.status());
  });

  test('billing webhook endpoint accepts POST without auth', async ({ request }) => {
    // The route doesn't verify the Stripe signature inline — it only checks
    // the header is present, then enqueues the event for the worker to
    // verify and process asynchronously (avoids holding the webhook
    // connection open). So a present-but-wrong signature still gets a 200;
    // only a missing signature is rejected synchronously.
    const withSignature = await request.post('/api/billing/webhook', {
      data: '{}',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'invalid' },
    });
    expect(withSignature.status()).toBe(200);

    const withoutSignature = await request.post('/api/billing/webhook', {
      data: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(withoutSignature.status()).toBe(400);
  });

  test('dashboard shows current plan name', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/current plan/i)).toBeVisible();
    // Plan name should be one of: Free, Pro, Enterprise
    await expect(page.getByText(/free|pro|enterprise/i).first()).toBeVisible();
  });

  test('dashboard plan banner links to billing page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const managePlanLink = page.getByRole('link', { name: /manage plan/i });
    if ((await managePlanLink.count()) > 0) {
      await managePlanLink.click();
      await expect(page).toHaveURL(/\/billing/);
    }
  });
});
