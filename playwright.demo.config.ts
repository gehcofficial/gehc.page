import { defineConfig, devices } from '@playwright/test';

/**
 * Konfigurasi perekaman demo PWA untuk pitch deck.
 * Video SELALU aktif; emulasi smartphone; POV mobile.
 *
 * Jalankan: npx playwright test --config=playwright.demo.config.ts
 * Output: public/media/demo/*.webm (lewat video.saveAs di spec)
 */
export default defineConfig({
  testDir: './tests/demo',
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8787',
    ...devices['Pixel 5'],
    video: { mode: 'on', size: { width: 390, height: 844 } },
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
