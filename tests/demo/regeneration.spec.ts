import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Demo alur Regenerasi (Pemimpin 10 Rumah) — screenshot tiap langkah + video.
 * Non-destruktif: konfirmasi "Tetapkan/Assign" dibatalkan; hanya Langkah 2
 * (Buka generasi) yang dieksekusi di staging (di-reset setelahnya).
 *
 * Jalankan:
 *   npx playwright test --config=playwright.demo-desktop.config.ts
 */
const OUT = path.resolve('docs/demo/regenerasi');
const EMAIL = 'tech@gehc.demo';
const PASSWORD = 'password123';

async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;' +
        'background:rgba(20,20,20,0.92);color:#fff;font:700 15px/1.35 system-ui,sans-serif;' +
        'padding:12px 18px;border-radius:999px;max-width:88%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4)';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(350);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test('alur regenerasi', async ({ page }) => {
  const login = await page.request.post('/api/auth/local', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.ok()).toBeTruthy();
  await page.request.post('/api/auth/active-role', { data: { role: 'SUPERADMIN' } });

  await page.goto('/#/portal/superadmin/beyonders-leaders', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /1 · Alumni/ }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  await caption(page, 'Panel Pemimpin 10 Rumah — wizard regenerasi 5 langkah');
  await shot(page, '01-panel');

  // Langkah 1 — Alumni
  await page.getByRole('button', { name: /1 · Alumni/ }).click();
  await page.waitForTimeout(500);
  await caption(page, 'Langkah 1 — Tandai Alumni (bulk, tercatat per generasi)');
  await shot(page, '02-langkah-1-alumni');

  // Langkah 2 — Buka generasi
  await page.getByRole('button', { name: /2 · Buka generasi/ }).click();
  await page.waitForTimeout(500);
  await caption(page, 'Langkah 2 — Buka generasi baru (konfirmasi ketik REGENERASI)');
  await shot(page, '03-langkah-2-buka-generasi');
  await page.locator('label:has-text("Override") input[type="checkbox"]').check().catch(() => {});
  await page.getByRole('button', { name: /Buka generasi berikutnya/ }).click();
  await page.waitForTimeout(500);
  await caption(page, 'Konfirmasi dampak sebelum eksekusi');
  await shot(page, '04-konfirmasi-buka-generasi');
  const typeInput = page.locator('input[placeholder="REGENERASI"]');
  if (await typeInput.count()) {
    await typeInput.fill('REGENERASI');
    await page.getByRole('button', { name: 'Buka generasi', exact: true }).click();
  }
  await page.waitForTimeout(2500);

  // Langkah 3 — Pemimpin (auto-advance setelah buka generasi)
  await caption(page, 'Langkah 3 — Tetapkan Mentor/Co-Mentor (peran portal sinkron)');
  await shot(page, '05-langkah-3-pemimpin');
  const firstAssign = page.getByRole('button', { name: 'Tetapkan Mentor', exact: true }).first();
  if (await firstAssign.isEnabled().catch(() => false)) {
    await firstAssign.click();
    await page.waitForTimeout(500);
    await caption(page, 'Konfirmasi: pemimpin lama otomatis turun jadi Mentee');
    await shot(page, '06-konfirmasi-tetapkan-mentor');
    await page.locator('[role="dialog"] button', { hasText: 'Batal' }).first().click().catch(async () => { await page.keyboard.press('Escape'); });
    await page.waitForTimeout(400);
  }

  // Langkah 4 — Bawa anggota
  await page.getByRole('button', { name: /4 · Bawa anggota/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Pratinjau/ }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await caption(page, 'Langkah 4 — Pratinjau: dibawa / dilewati (pindah) / alumni');
  await shot(page, '07-langkah-4-bawa-anggota');

  // Langkah 5 — Assign baru
  await page.getByRole('button', { name: /5 · Assign baru/ }).click();
  await page.waitForTimeout(500);
  await caption(page, 'Langkah 5 — Assign orang ke rumah');
  await shot(page, '08-langkah-5-assign');
  await caption(page, 'Selesai — verifikasi status anggota per rumah');
});
