import { defineConfig, devices } from '@playwright/test';

/**
 * Perekam demo alur Regenerasi (desktop) — SS + video.
 * Jalankan: npx playwright test --config=playwright.demo-desktop.config.ts
 * Output: docs/demo/regenerasi/*.png + *.webm
 *
 * Memakai `npm run dev` (localhost:8787) yang mengarah ke DB staging.
 */
export default defineConfig({
  testDir: './tests/demo',
  testMatch: '**/regeneration.spec.ts',
  timeout: 600000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8787',
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 900 },
    video: { mode: 'on', size: { width: 1366, height: 900 } },
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
