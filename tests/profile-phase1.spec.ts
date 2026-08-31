import { test, expect } from '@playwright/test';
import {
  loginViaDemo,
  navigateToMenu,
  openProfileSection,
  switchToPortal,
} from './helpers/portal';

test.describe('Profil UX Phase 1', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loginViaDemo(page);
    await switchToPortal(page);
  });

  test('Header: nama, email, dan label data gereja tampil', async ({ page }) => {
    await navigateToMenu(page, 'Profil saya');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByText('tech@gehc.demo')).toBeVisible();
    await expect(page.getByText('Data gereja (admin)')).toBeVisible();
    await expect(page.getByText(/hubungi sekretaris/i)).toBeVisible();
  });

  test('Status hidup: form kerja dengan industri', async ({ page }) => {
    await openProfileSection(page, /Status hidup/i);
    await page.getByRole('button', { name: 'Bekerja' }).click();
    await page.getByPlaceholder(/Nama kantor/i).fill('PT E2E Test Cikarang');
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Industri / sektor' }) }).selectOption('Manufaktur');
    await page.getByPlaceholder(/Jabatan/i).fill('Engineer');

    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/api/me/profile') && r.request().method() === 'PATCH' && r.ok(),
    );
    await page.getByRole('button', { name: 'Simpan segmen ini' }).click();
    const saved = await (await savePromise).json();
    expect(saved.user.workplaceName).toBe('PT E2E Test Cikarang');
    expect(saved.user.workIndustry).toBe('Manufaktur');
    expect(saved.user.workRole).toBe('Engineer');
  });

  test('Karunia rohani: wizard atau hasil Top-5 tampil', async ({ page }) => {
    await openProfileSection(page, /Karunia rohani/i);
    const wizard = page.getByText(/Jawab semua pernyataan/i);
    const top5 = page.getByText('Top-5 Karunia Rohani');
    const hasWizard = await wizard.isVisible().catch(() => false);
    const hasTop5 = await top5.isVisible().catch(() => false);
    expect(hasWizard || hasTop5).toBeTruthy();
    if (hasTop5) {
      await expect(page.getByRole('button', { name: 'Ulangi tes' })).toBeVisible();
    }
  });

  test('Minat: search bar memfilter chip', async ({ page }) => {
    await openProfileSection(page, /Minat/i);
    const search = page.getByPlaceholder('Cari minat…');
    await expect(search).toBeVisible();
    await search.fill('zzz-tidak-ada');
    await expect(page.getByText(/Tidak ada minat yang cocok/i)).toBeVisible();
    await search.fill('');
    await expect(page.getByText('Sports')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lainnya…' }).first()).toBeVisible();
  });
});
