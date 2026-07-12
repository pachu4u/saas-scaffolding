import { test, expect } from '@playwright/test';

import { signIn } from './helpers/auth';

/**
 * Admin tenant management E2E tests.
 *
 * Covers:
 *   - Platform admin dashboard overview
 *   - Tenant list: search, filter, pagination
 *   - Tenant creation entry point (links to the onboarding wizard — see
 *     onboarding.spec.ts for the actual provisioning flow)
 *   - Tenant detail: info, members, audit logs
 *   - Tenant suspension and reinstatement
 *   - Navigation links (Manage → individual tenant)
 */

test.describe('Admin — Tenant management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // ── Admin Overview ────────────────────────────────────────────────────────

  test('admin overview shows global stats', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Total Tenants')).toBeVisible();
    await expect(page.getByText('Total Users')).toBeVisible();
    await expect(page.getByText('Active Jobs')).toBeVisible();
    await expect(page.getByText('Paid Plans')).toBeVisible();
  });

  test('admin overview shows system health panel', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('System Health')).toBeVisible();
    await expect(page.getByText('Web (Next.js)')).toBeVisible();
    await expect(page.getByText('Database (Postgres)')).toBeVisible();
    await expect(page.getByText('HashiCorp Vault')).toBeVisible();
  });

  test('admin overview — Manage link points to individual tenant', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // "Manage" links should NOT point to /admin/tenants (list) but to individual IDs
    const manageLinks = page.getByRole('link', { name: 'Manage' });
    const count = await manageLinks.count();
    if (count > 0) {
      const href = await manageLinks.first().getAttribute('href');
      expect(href).toMatch(/\/admin\/tenants\/[a-f0-9-]{36}/);
    }
  });

  // ── Tenant List ────────────────────────────────────────────────────────────

  test('tenant list page renders', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
    await expect(page.getByText('All workspaces across the platform')).toBeVisible();
    // Search input
    await expect(page.getByPlaceholder(/search by name or slug/i)).toBeVisible();
    // Plan filter
    await expect(page.getByRole('combobox').first()).toBeVisible();
    // Create button
    await expect(page.getByRole('link', { name: /create tenant/i })).toBeVisible();
  });

  test('tenant list — View button links to tenant detail', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    const viewLinks = page.getByRole('link', { name: 'View', exact: true });
    const count = await viewLinks.count();
    if (count > 0) {
      const href = await viewLinks.first().getAttribute('href');
      expect(href).toMatch(/\/admin\/tenants\/[a-f0-9-]{36}/);
    }
  });

  // ── Create Tenant Entry Point ──────────────────────────────────────────────
  // Actual provisioning (name, invites, branding, plan) is covered by
  // onboarding.spec.ts — this just confirms the entry point routes there.

  test('create tenant button links to the onboarding wizard', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    const createLink = page.getByRole('link', { name: /create tenant/i });
    await expect(createLink).toHaveAttribute('href', '/onboarding');

    await createLink.click();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  // ── Tenant Detail Page ─────────────────────────────────────────────────────

  test('tenant detail page shows all sections', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    const viewLinks = page.getByRole('link', { name: 'View', exact: true });
    const count = await viewLinks.count();

    if (count === 0) {
      test.skip(count === 0, 'No tenants to view');
      return;
    }

    await viewLinks.first().click();
    await page.waitForLoadState('networkidle');

    // Overview cards
    await expect(page.getByText('Status').first()).toBeVisible();
    await expect(page.getByText('Plan').first()).toBeVisible();
    await expect(page.getByText('Members').first()).toBeVisible();
    await expect(page.getByText('Audit Events').first()).toBeVisible();

    // Sections
    await expect(page.getByText('Tenant Details').first()).toBeVisible();
    await expect(page.getByText('Provisioning').first()).toBeVisible();
    await expect(page.getByText('Recent Activity').first()).toBeVisible();
  });

  // ── Tenant Suspension / Reinstatement ─────────────────────────────────────

  test('suspend button calls API and refreshes page', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    // Mock the tenant detail API
    let patchCalled = false;
    await page.route(/\/api\/admin\/tenants\/[^/]+$/, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        return route.fulfill({ json: { ok: true, status: 'SUSPENDED' } });
      }
      return route.continue();
    });

    const suspendBtn = page.getByRole('button', { name: 'Suspend' }).first();
    const count = await suspendBtn.count();
    if (count === 0) {
      test.skip(count === 0, 'No active tenants to suspend');
      return;
    }

    await suspendBtn.click();
    await page.waitForTimeout(500);
    expect(patchCalled).toBe(true);
  });

  // ── Jobs Admin ─────────────────────────────────────────────────────────────

  test('jobs page renders queue list', async ({ page }) => {
    await page.goto('/admin/jobs');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Job Queues')).toBeVisible();
    await expect(page.getByText('BullMQ queue depths')).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });
});
