import { test, expect } from '@playwright/test';
import {
  loginViaLocal,
  switchToPortal,
  navigateToMenu,
  editProfileModal,
  pickSearchable,
  ensureIndonesiaScope,
} from '../helpers/portal';

test.describe('Admin Direktori Jemaat — domisili Wilayah.id', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await loginViaLocal(page);
    await switchToPortal(page, 'Superadmin');
    await navigateToMenu(page, 'Jemaat');
  });

  test('modal Edit Profil: cascade Wilayah.id terisi', async ({ page }) => {
    await page.locator('button[title="Edit profil"]').first().click();
    const modal = editProfileModal(page);
    await expect(modal.getByRole('heading', { name: /Edit Profil/ })).toBeVisible({ timeout: 15000 });

    await ensureIndonesiaScope(modal);
    await pickSearchable(modal, /Cari provinsi/i, /Jawa Barat/i, 'Jawa Barat');
    await pickSearchable(modal, /kabupaten \/ kota/i, /Bekasi/i, 'Bekasi');

    // SearchableSelect menampilkan label pilihan setelah dipilih.
    await expect(modal.getByText('Jawa Barat').first()).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText('Bekasi').first()).toBeVisible({ timeout: 10000 });
  });
});
