import { test, expect } from '@playwright/test';
import {
  loginViaLocal,
  switchToPortal,
  navigateToMenu,
  openProfileSection,
  pickSearchable,
  ensureIndonesiaScope,
} from '../helpers/portal';

test.describe('Address flow — Profil & Direktori domisili', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginViaLocal(page);
    await switchToPortal(page);
  });

  test('Profil saya: cascade Wilayah.id + simpan alamat Indonesia', async ({ page }) => {
    await openProfileSection(page, /Kontak & alamat/i);
    await ensureIndonesiaScope(page);

    await pickSearchable(page, /Cari provinsi/i, /Jawa Barat/i, 'Jawa Barat');
    await pickSearchable(page, /kabupaten \/ kota/i, /Bekasi/i, 'Bekasi');

    const line = `Jl. E2E ${Date.now()}`;
    await page.getByPlaceholder('Jalan & nomor').fill(line);

    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/me/profile') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Simpan segmen ini' }).click();
    const body = await (await saved).json();
    expect(body.user.addressScope).toBe('ID');
    expect(body.user.addressLine).toBe(line);
  });

  test('Direktori Jemaat: filter domisili memanggil API addressScope', async ({ page }) => {
    await navigateToMenu(page, 'Jemaat');
    await expect(page.getByRole('heading', { name: 'Direktori Jemaat' })).toBeVisible({ timeout: 20000 });

    const filter = page.locator('select').filter({ has: page.locator('option', { hasText: 'Semua Domisili' }) });
    const resp = page.waitForResponse(
      (r) => r.url().includes('/api/jemaat') && r.url().includes('addressScope=INTL') && r.ok(),
    );
    await filter.selectOption('INTL');
    await resp;
  });
});
