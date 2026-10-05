import { defineConfig, devices } from '@playwright/test';

/**
 * Simulasi Pemilihan Pelsus 11 Okt — klip video per adegan + caption Indonesia.
 * Target lokal (DB staging), election khusus SIMULASI, bersih total di akhir.
 *
 * Jalankan: npm run pelsus:sim
 * Output: public/media/pelsus/01..05-*.webm
 */
export default defineConfig({
  testDir: './tests/demo',
  testMatch: /pelsus-simulasi\.spec\.ts/,
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8787',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'off',
  },
  webServer: {
    // Sajikan build produksi (instan, tanpa kompilasi Vite) agar rekaman
    // langsung berisi konten — sekaligus memiripkan kondisi hari-H (Vercel).
    // Syarat: sudah `npm run build` setelah perubahan src terakhir.
    command: 'node server/index.mjs',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 120000,
    env: { NODE_ENV: 'production' },
  },
  expect: {
    timeout: 20000,
  },
});
