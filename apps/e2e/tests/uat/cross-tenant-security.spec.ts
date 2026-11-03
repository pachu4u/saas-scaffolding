import { test, expect, type Page } from '@playwright/test';

/**
 * UAT suite — production-only cross-tenant security & latency regression
 * guards. See UAT_TEST_PLAN.md sections 6 and 7 for the business-readable
 * case descriptions (UAT-307, UAT-601, UAT-603, UAT-701, UAT-702).
 *
 * Runs against real *.riogentix.com, not local dev — local dev is
 * single-tenant and can't exercise real subdomain routing or the real
 * Keycloak cross-domain SSO handoff. Run via:
 *   UAT_TENANT_SLUG=<slug> npx playwright test --config playwright.uat.config.ts
 */

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@platform.test';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'platform123';

// A disposable test tenant the platform admin is NOT a member of. Defaults to
// the tenant this suite's cases were originally reproduced against — override
// with your own throwaway tenant slug so this doesn't depend on that one
// tenant continuing to exist.
const TENANT_SLUG = process.env.UAT_TENANT_SLUG ?? 'test-corporation-3';
const TENANT_BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN ?? 'riogentix.com';

function tenantOrigin(): string {
  return `https://${TENANT_SLUG}.${TENANT_BASE_DOMAIN}`;
}

/**
 * Signs in as the platform admin via the real Keycloak-backed flow, starting
 * from the control-plane root domain (not a tenant subdomain) — mirrors
 * apps/e2e/tests/helpers/auth.ts's signIn(), but against production domains
 * instead of app.lvh.me/auth.lvh.me.
 */
async function signInAsPlatformAdmin(page: Page): Promise<void> {
  await page.goto('/auth/signin');
  await page.getByRole('button', { name: /continue with sso/i }).click();
  await page.waitForURL(/auth\.riogentix\.com/);
  await page.getByLabel(/username|email/i).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  // Lands back on saas.riogentix.com once Auth.js's callback completes.
  await page.waitForURL(/saas\.riogentix\.com/, { timeout: 15_000 });
}

test.describe('UAT-6xx — Cross-tenant security & isolation', () => {
  test('UAT-601: anonymous visitor to a tenant subdomain is redirected to sign-in, never shown tenant data', async ({
    browser,
  }) => {
    // Fresh, cookie-less context — simulates a visitor with no session at all.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(tenantOrigin());
    await page.waitForLoadState('networkidle');

    // Whatever the exact path (the initial hop may be transient), the visitor
    // must end up on a sign-in page, never on tenant content.
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.getByRole('button', { name: /continue with sso/i })).toBeVisible();

    await context.close();
  });

  test('UAT-603 / UAT-802: public branding endpoint responds without auth, for this tenant host', async ({
    request,
  }) => {
    // Mounted under /api/v1 in the Riogentix FastAPI app, even though the
    // router's own prefix is /internal/saas — the bare path 307s into the
    // control plane's signin flow instead (confirmed the hard way once
    // already this investigation).
    const res = await request.get(`${tenantOrigin()}/api/v1/internal/saas/branding`);
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { branding?: Record<string, unknown> };
    expect(body).toHaveProperty('branding');

    // Never leaks plan/usage-lock/internal fields — see saas_public.py's
    // _PUBLIC_BRANDING_FIELDS allowlist. Spot-check a couple of fields that
    // must never appear here even if present on the tenant record.
    const leaked = Object.keys(body.branding ?? {}).filter((k) =>
      ['plan', 'usage_locked', 'resource_limits'].includes(k),
    );
    expect(leaked).toEqual([]);
  });

  test('UAT-702 / UAT-801: GET /api/v1/version on the tenant subdomain bypasses the control plane and responds fast', async ({
    request,
  }) => {
    const started = Date.now();
    const res = await request.get(`${tenantOrigin()}/api/v1/version`);
    const elapsedMs = Date.now() - started;

    expect(res.status()).toBe(200);
    const body = (await res.json()) as { version?: string };
    expect(body.version).toBeTruthy();
    expect(elapsedMs).toBeLessThan(1_000);
  });
});

test.describe('UAT-3xx/7xx — Platform admin on a foreign tenant subdomain (2026-11-03 regression guard)', () => {
  test('UAT-307 / UAT-701: redirects to the real platform console, well under the old 30-120s hang', async ({
    page,
  }) => {
    await signInAsPlatformAdmin(page);

    const started = Date.now();
    await page.goto(`${tenantOrigin()}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const elapsedMs = Date.now() - started;

    // The fix (packages/db/src/client.ts connect_timeout/pool_timeout +
    // apps/web/src/lib/server-tenant.ts cache()) bounds worst-case latency
    // to roughly 2x a single connection-timeout attempt. 5s leaves a very
    // large margin over the ~0.2s observed post-fix, while still being two
    // orders of magnitude below the 30-120s pre-fix hang this guards against.
    expect(elapsedMs).toBeLessThan(5_000);

    // Must land on the REAL platform console (root domain), not the tenant's
    // own /t/{slug}/admin tree — a platform admin with no membership in this
    // tenant must never be shown that tenant's admin data.
    await expect(page).toHaveURL(/^https:\/\/saas\.riogentix\.com\/admin/);
  });
});
