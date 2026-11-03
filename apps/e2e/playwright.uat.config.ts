import { defineConfig, devices } from '@playwright/test';

/**
 * UAT config — targets real production (*.riogentix.com), unlike
 * playwright.config.ts which targets local dev (app.lvh.me).
 *
 * This exists specifically because local dev is single-tenant and cannot
 * exercise real tenant-subdomain routing, the real Keycloak cross-domain SSO
 * handoff, or real k3s pod provisioning — see UAT_TEST_PLAN.md's intro table
 * for exactly what each suite can and can't prove.
 *
 * Deliberately: a single browser (chromium), no retries (these tests assert
 * timing — retrying a flaky slow request defeats the point), low parallelism
 * (this hits real production infrastructure, not a disposable local stack).
 */
export default defineConfig({
  testDir: './tests/uat',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { outputFolder: 'uat-report' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://saas.riogentix.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false, // real certs in production — never relax this here
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
