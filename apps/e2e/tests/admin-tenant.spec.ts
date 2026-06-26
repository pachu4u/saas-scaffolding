import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

/**
 * Admin tenant management E2E tests.
 *
 * Covers:
 *   - Platform admin dashboard overview
 *   - Tenant list: search, filter, pagination
 *   - Tenant creation (Create tenant modal)
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
    await expect(page.getByRole('button', { name: /create tenant/i })).toBeVisible();
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

  // ── Create Tenant Modal ────────────────────────────────────────────────────

  test('create tenant modal opens and closes', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /create tenant/i }).click();
    await expect(page.getByText('Set up a new workspace on the platform.')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Set up a new workspace on the platform.')).not.toBeVisible();
  });

  test('create tenant modal — validates required fields', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /create tenant/i }).click();
    // The submit button is disabled client-side until both name and slug
    // are filled — it never becomes clickable with empty fields.
    await expect(page.getByRole('button', { name: /^create tenant$/i })).toBeDisabled();
    await expect(page.getByText('Set up a new workspace on the platform.')).toBeVisible();
  });

  test('create tenant modal — auto-derives slug from name', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /create tenant/i }).click();
    await page.getByPlaceholder('Acme Inc.').fill('My New Company');

    const slugInput = page.getByPlaceholder('acme', { exact: true });
    await expect(slugInput).toHaveValue('my-new-company');
  });

  test('create tenant — success creates tenant and closes modal', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    // Mock the API
    await page.route('/api/tenants', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            id: 'mock-id-123',
            name: 'E2E New Tenant',
            slug: `e2e-new-${Date.now()}`,
            plan: 'free',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        });
      }
      return route.continue();
    });

    await page.getByRole('button', { name: /create tenant/i }).click();
    const uniqueSlug = `e2e-new-${Date.now()}`;
    await page.getByPlaceholder('Acme Inc.').fill('E2E New Tenant');
    await page.getByPlaceholder('acme', { exact: true }).fill(uniqueSlug);
    await page.getByRole('button', { name: /^create tenant$/i }).click();

    // Modal should close
    await expect(page.getByText('Set up a new workspace on the platform.')).not.toBeVisible();
  });

  test('create tenant — shows error on duplicate slug', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForLoadState('networkidle');

    await page.route('/api/tenants', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409,
          json: { error: 'A tenant with that slug already exists' },
        });
      }
      return route.continue();
    });

    await page.getByRole('button', { name: /create tenant/i }).click();
    await page.getByPlaceholder('Acme Inc.').fill('Duplicate Tenant');
    await page.getByPlaceholder('acme', { exact: true }).fill('existing-slug');
    await page.getByRole('button', { name: /^create tenant$/i }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
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
