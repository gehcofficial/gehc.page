import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Perekam demo PWA untuk pitch deck (POV smartphone).
 * Menghasilkan 3 klip webm di public/media/demo/.
 *
 * Catatan: dialog install OS (Android/iOS) & prompt izin notifikasi adalah UI
 * browser/OS yang tidak bisa direkam Playwright — langkah tsb diperagakan
 * lewat caption + state aplikasi.
 */

const OUT_DIR = path.resolve('public/media/demo');

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
  await page.waitForTimeout(500);
}

async function zoomTo(page: Page, selector: string, scale = 1.6) {
  const box = await page.locator(selector).first().boundingBox().catch(() => null);
  const cx = box ? box.x + box.width / 2 : 195;
  const cy = box ? box.y + box.height / 2 : 420;
  await page.evaluate(({ scale, cx, cy }) => {
    const root = document.getElementById('root') || document.body;
    root.style.transition = 'transform .6s ease';
    root.style.transformOrigin = `${cx}px ${cy}px`;
    root.style.transform = `scale(${scale})`;
  }, { scale, cx, cy });
  await page.waitForTimeout(700);
}

async function resetZoom(page: Page) {
  await page.evaluate(() => {
    const root = document.getElementById('root') || document.body;
    root.style.transition = 'transform .6s ease';
    root.style.transform = 'scale(1)';
  });
  await page.waitForTimeout(500);
}

async function loginDemo(page: Page) {
  const r = await page.request.post('/api/auth/local', { data: { email: 'tech@gehc.demo', password: 'password123' } });
  expect(r.ok()).toBeTruthy();
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test('01 daftar', async ({ page }) => {
  const video = page.video();
  await page.goto('/#/register');
  await page.waitForTimeout(1500);
  await caption(page, 'Buka youth.gehc.page → Daftar');
  await zoomTo(page, 'form', 1.3);

  await page.getByPlaceholder('cth. Meyke').first().fill('Demo');
  await page.getByPlaceholder('cth. Poluan').first().fill('Peserta');
  await page.locator('input[type="email"]').last().fill(`demo.pwa.${Date.now()}@gehc.page`);
  await page.locator('input[type="password"]').last().fill('password123');
  await page.getByPlaceholder('08xxxxxxxxxx').first().fill('081234567890');
  await resetZoom(page);

  await caption(page, 'Isi nama, email, kata sandi — lalu ketuk Daftar');
  await page.getByRole('button', { name: /Daftar dengan Email/i }).click();
  await page.waitForTimeout(3000);
  await caption(page, 'Akun dibuat — lengkapi profil & tes karunia');
  await page.waitForTimeout(1800);

  await page.close();
  await video?.saveAs(path.join(OUT_DIR, '01-daftar.webm'));
});

test('02 pasang aplikasi', async ({ page }) => {
  const video = page.video();
  await loginDemo(page);
  await page.goto('/#/portal/superadmin/dashboard');
  await page.waitForTimeout(2500);
  await caption(page, 'Buka menu → Pasang GEHC Youth');
  await zoomTo(page, 'text=Pasang GEHC Youth', 1.7);
  await page.waitForTimeout(800);
  await caption(page, 'Ketuk Pasang / Install app → Tambahkan ke Layar Utama');
  await resetZoom(page);
  await page.waitForTimeout(1500);
  await caption(page, 'Ikon GEHC muncul di HP — buka seperti aplikasi biasa');
  await page.waitForTimeout(1800);

  await page.close();
  await video?.saveAs(path.join(OUT_DIR, '02-pasang.webm'));
});

test('03 aktifkan notifikasi', async ({ page, context }) => {
  const video = page.video();
  await context.grantPermissions(['notifications']);
  await loginDemo(page);
  await page.goto('/#/portal/superadmin/dashboard');
  await page.waitForTimeout(2500);
  await caption(page, 'Aktifkan notifikasi agar info terbaru masuk');
  await zoomTo(page, 'text=Notifikasi Push', 1.7);
  const btn = page.getByRole('button', { name: /Aktifkan/i }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
  }
  await resetZoom(page);
  await caption(page, 'Selesai — pengingat agenda & informasi langsung masuk');
  await page.waitForTimeout(1800);

  await page.close();
  await video?.saveAs(path.join(OUT_DIR, '03-notifikasi.webm'));
});
