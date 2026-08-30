import { test, expect } from '@playwright/test';
import {
  addressForm,
  loginViaDemo,
  navigateToMenu,
  switchToPortal,
  waitForProvinceOptions,
  waitWilayah,
} from './helpers/portal';

test.describe('Address flow — Profil & Direktori domisili', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loginViaDemo(page);
    await switchToPortal(page);
  });

  test('Profil saya: cascade Wilayah.id + simpan alamat Indonesia', async ({ page }) => {
    await navigateToMenu(page, 'Profil saya');
    await page.getByRole('button', { name: /Kontak & alamat/i }).click();

    const form = addressForm(page);
    const onIntl = await form.getByRole('button', { name: 'Luar negeri' }).evaluate(
      (el) => el.classList.contains('bg-[#181818]') || el.className.includes('bg-[#181818]'),
    );
    if (onIntl) {
      const provincesPromise = waitWilayah(page, 'provinces');
      await form.getByRole('button', { name: 'Indonesia' }).click();
      await provincesPromise;
    }

    const provinceSelect = await waitForProvinceOptions(form);
    const regencySelect = form.locator('select').nth(1);

    const bantenRegencies = waitWilayah(page, 'regencies');
    await provinceSelect.selectOption('36');
    await bantenRegencies;

    const jabarRegencies = waitWilayah(page, 'regencies');
    await provinceSelect.selectOption('32');
    await jabarRegencies;
    await expect(regencySelect).toBeEnabled();
    await regencySelect.selectOption('32.16');

    const addressLine = form.getByPlaceholder('Jalan & nomor');
    await addressLine.fill('Jl. E2E Test No. 42');

    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/api/me/profile') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Simpan segmen ini' }).click();
    const saved = await (await savePromise).json();

    expect(saved.user.province).toMatch(/Jawa Barat/i);
    expect(saved.user.city).toMatch(/Bekasi/i);
    expect(saved.user.addressLine).toBe('Jl. E2E Test No. 42');
    expect(saved.user.addressScope).toBe('ID');
    await expect(page.getByText('Profil diperbarui')).toBeVisible();

    await navigateToMenu(page, 'Profil saya');
    await page.getByRole('button', { name: /Kontak & alamat/i }).click();
    await expect(form.locator('select').nth(0)).toHaveValue(saved.user.provinceCode);
    await expect(form.locator('select').nth(1)).toHaveValue(saved.user.cityCode);
    await expect(addressLine).toHaveValue('Jl. E2E Test No. 42');
  });

  test('Profil saya: simpan alamat luar negeri lalu restore Indonesia', async ({ page }) => {
    await navigateToMenu(page, 'Profil saya');
    await page.getByRole('button', { name: /Kontak & alamat/i }).click();

    const form = addressForm(page);
    await form.getByRole('button', { name: 'Luar negeri' }).click();
    await form.locator('select').first().selectOption({ label: 'Singapura' });
    await form.getByPlaceholder('Kota').fill('Singapore');
    await form.getByPlaceholder(/Alamat jalan/i).fill('Orchard Road E2E');

    const intlSave = page.waitForResponse(
      (r) => r.url().includes('/api/me/profile') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Simpan segmen ini' }).click();
    const saved = await (await intlSave).json();
    expect(saved.user.addressScope).toBe('INTL');
    expect(saved.user.addressCountry).toBe('SG');
    expect(saved.user.city).toBe('Singapore');

    const provincesPromise = waitWilayah(page, 'provinces');
    await form.getByRole('button', { name: 'Indonesia' }).click();
    await provincesPromise;
    const provinceSelect = await waitForProvinceOptions(form);

    const jabarRegencies = waitWilayah(page, 'regencies');
    await provinceSelect.selectOption('32');
    await jabarRegencies;
    await form.locator('select').nth(1).selectOption('32.16');
    await form.getByPlaceholder('Jalan & nomor').fill('Jl. E2E Test No. 42');

    const restoreSave = page.waitForResponse(
      (r) => r.url().includes('/api/me/profile') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Simpan segmen ini' }).click();
    const restored = await (await restoreSave).json();
    expect(restored.user.addressScope).toBe('ID');
  });

  test('Direktori Jemaat: filter domisili ID vs INTL', async ({ page }) => {
    await navigateToMenu(page, 'Jemaat');
    await expect(page.getByRole('heading', { name: 'Direktori Jemaat' })).toBeVisible();
    await expect(page.getByText(/Menampilkan \d+ dari \d+ anggota/)).toBeVisible();

    const domicileSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: 'Semua Domisili' }),
    });

    const idApiPromise = page.waitForResponse(
      (r) => r.url().includes('/api/jemaat') && r.url().includes('addressScope=ID') && r.ok(),
    );
    await domicileSelect.selectOption('ID');
    const idData = await (await idApiPromise).json();
    for (const u of idData.youth || []) {
      expect(u.addressScope === 'ID' || !u.addressScope).toBeTruthy();
    }
    if ((idData.youth || []).length > 0) {
      await expect(page.locator('span.bg-sky-50.text-sky-700', { hasText: 'Indonesia' }).first()).toBeVisible();
    }

    const intlApiPromise = page.waitForResponse(
      (r) => r.url().includes('/api/jemaat') && r.url().includes('addressScope=INTL') && r.ok(),
    );
    await domicileSelect.selectOption('INTL');
    const intlData = await (await intlApiPromise).json();
    for (const u of intlData.youth || []) {
      expect(u.addressScope).toBe('INTL');
    }
    if ((intlData.youth || []).length > 0) {
      const badges = await page.locator('span.bg-sky-50.text-sky-700').allTextContents();
      expect(badges.some((t) => t !== 'Indonesia')).toBeTruthy();
    } else {
      await expect(page.getByText(/Menampilkan 0 dari/)).toBeVisible();
    }
  });
});
