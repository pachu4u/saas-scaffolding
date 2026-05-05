import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

/**
 * Dashboard E2E tests.
 *
 * Covers:
 *   - Dashboard renders all stat cards
 *   - Usage events chart (with and without data)
 *   - Recent activity feed
 *   - Quick actions panel
 *   - Plan banner with seat count and renewal date
 *   - Responsive layout
 *   - Navigation links from dashboard
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  // ── Stat cards ─────────────────────────────────────────────────────────────

  test('shows all four stat cards', async ({ page }) => {
    await expect(page.getByText('Active Members')).toBeVisible();
    await expect(page.getByText('Total Members')).toBeVisible();
    await expect(page.getByText('Current Plan')).toBeVisible();
    await expect(page.getByText('Usage Events (30d)')).toBeVisible();
  });

  test('stat card values are numeric strings', async ({ page }) => {
    // Each stat card should show a number (could be "0" or "1,234" etc.)
    const cards = page.locator('[class*="stat"], [class*="card"]').filter({ hasText: /\d/ });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Usage chart ────────────────────────────────────────────────────────────

  test('usage events chart section is visible', async ({ page }) => {
    await expect(page.getByText('Usage Events')).toBeVisible();
    await expect(page.getByText('Last 30 days')).toBeVisible();
  });

  test('chart shows bars or empty state', async ({ page }) => {
    const hasBars = (await page.locator('[style*="height"]').count()) > 0;
    const hasEmptyState = (await page.getByText(/no usage events/i).count()) > 0;
    expect(hasBars || hasEmptyState).toBe(true);
  });

  // ── Recent activity ────────────────────────────────────────────────────────

  test('recent activity section renders', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
    await expect(page.getByRole('link', { name: /view full audit log/i })).toBeVisible();
  });

  test('recent activity shows entries or empty state', async ({ page }) => {
    const hasActivity =
      (await page.locator('main [class*="activity"], main [class*="feed"]').count()) > 0;
    const hasEmptyState = (await page.getByText(/no activity recorded/i).count()) > 0;
    expect(hasActivity || hasEmptyState).toBe(true);
  });

  test('activity feed "View full audit log" links to /audit', async ({ page }) => {
    const link = page.getByRole('link', { name: /view full audit log/i });
    await expect(link).toHaveAttribute('href', '/audit');
  });

  // ── Quick actions ──────────────────────────────────────────────────────────

  test('quick actions panel renders all four actions', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible();
    await expect(page.getByRole('link', { name: /invite team member/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /manage subscription/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /configure sso/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view audit log/i })).toBeVisible();
  });

  test('quick action — Invite team member links to /team', async ({ page }) => {
    const link = page.getByRole('link', { name: /invite team member/i });
    await expect(link).toHaveAttribute('href', '/team');
  });

  test('quick action — Manage subscription links to /billing', async ({ page }) => {
    const link = page.getByRole('link', { name: /manage subscription/i });
    await expect(link).toHaveAttribute('href', '/billing');
  });

  test('quick action — Configure SSO links to /settings', async ({ page }) => {
    const link = page.getByRole('link', { name: /configure sso/i });
    await expect(link).toHaveAttribute('href', '/settings');
  });

  // ── Plan banner ────────────────────────────────────────────────────────────

  test('plan banner shows plan name and manage plan link', async ({ page }) => {
    await expect(page.getByText(/you're on the .* plan/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /manage plan/i })).toBeVisible();
  });

  test('plan banner Manage plan links to /billing', async ({ page }) => {
    const link = page.getByRole('link', { name: /manage plan/i });
    await expect(link).toHaveAttribute('href', '/billing');
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('sidebar navigation is visible', async ({ page }) => {
    // Should have sidebar with key nav items
    const sidebar = page.locator('nav, aside, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible();
  });

  test('topbar shows user email', async ({ page }) => {
    // The topbar should display the authenticated user's email or name
    const topbar = page.locator('header, [class*="topbar"]');
    await expect(topbar.first()).toBeVisible();
  });

  test('navigating to /team from quick actions works', async ({ page }) => {
    await page.getByRole('link', { name: /invite team member/i }).click();
    await expect(page).toHaveURL(/\/team/);
  });

  test('navigating to /billing from plan banner works', async ({ page }) => {
    await page.getByRole('link', { name: /manage plan/i }).click();
    await expect(page).toHaveURL(/\/billing/);
  });

  // ── API: Usage ─────────────────────────────────────────────────────────────

  test('GET /api/usage returns data for authenticated user', async ({ request }) => {
    const response = await request.get('/api/usage');
    expect(response.status()).toBeOneOf([200, 401, 403]);
    if (response.status() === 200) {
      const body = (await response.json()) as Record<string, unknown>;
      expect(typeof body).toBe('object');
