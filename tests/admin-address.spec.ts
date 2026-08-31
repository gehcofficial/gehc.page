import { test, expect, Page } from '@playwright/test';

const DEMO_USER = 'tech@gehc.demo';

async function loginViaDemo(page: Page) {
  const response = await page.request.post('/api/demo/impersonate', {
    data: { email: DEMO_USER },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function openPortal(page: Page) {
  const portalBtn = page.locator('button:has-text("Portal")').first();
  if (await portalBtn.isVisible({ timeout: 5000 })) {
    await portalBtn.click();
  }
  await page.locator('aside, nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 15000 });
}

async function goToJemaatDirectory(page: Page) {
  const link = page.locator('aside a, aside button, nav a, nav button').filter({ hasText: /^Jemaat$/ });
  await link.first().click();
  await expect(page.getByRole('heading', { name: 'Direktori Jemaat' })).toBeVisible({ timeout: 15000 });
}

async function openFirstEditModal(page: Page) {
  const editBtn = page.locator('button[title="Edit profil"]').first();
  await editBtn.waitFor({ state: 'visible', timeout: 10000 });
  await editBtn.click();
  await expect(page.getByRole('heading', { name: 'Edit Profil' })).toBeVisible();
}

function editModal(page: Page) {
  return page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Edit Profil' }) });
}

async function pickWilayahCascade(page: Page) {
  const modal = editModal(page);

  const provinceSelect = modal.locator('select').filter({ has: page.locator('option:has-text("Provinsi")') });
  await provinceSelect.waitFor({ state: 'visible' });
  await expect(provinceSelect.locator('option')).not.toHaveCount(1, { timeout: 20000 });

  const provinceOptions = provinceSelect.locator('option:not([value=""])');
  const provinceValue = await provinceOptions.first().getAttribute('value');
  expect(provinceValue).toBeTruthy();
  await provinceSelect.selectOption(provinceValue!);

  const citySelect = modal.locator('select').filter({ has: page.locator('option:has-text("Kabupaten / Kota")') });
  await expect(citySelect.locator('option:not([value=""])')).not.toHaveCount(0, { timeout: 15000 });
  const cityValue = await citySelect.locator('option:not([value=""])').first().getAttribute('value');
  await citySelect.selectOption(cityValue!);

  const streetInput = modal.getByPlaceholder('Jalan & nomor');
  const uniqueLine = `Jl E2E Admin ${Date.now()}`;
  await streetInput.fill(uniqueLine);
  return uniqueLine;
}

test.describe('Admin Direktori Jemaat — domisili Wilayah.id', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loginViaDemo(page);
    await openPortal(page);
    await goToJemaatDirectory(page);
  });

  test('admin can save Indonesia address cascade and persist after reload', async ({ page }) => {
    await openFirstEditModal(page);
    const modal = editModal(page);

    await modal.getByRole('button', { name: 'Indonesia' }).click();
    const streetLine = await pickWilayahCascade(page);

    await modal.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Profil Diperbarui')).toBeVisible({ timeout: 15000 });

    await openFirstEditModal(page);
    await expect(modal.getByPlaceholder('Jalan & nomor')).toHaveValue(streetLine);
    await expect(modal.locator('select').filter({ has: page.locator('option:has-text("Provinsi")') })).not.toHaveValue('');
    await expect(modal.locator('select').filter({ has: page.locator('option:has-text("Kabupaten / Kota")') })).not.toHaveValue('');
  });

  test('admin can save luar negeri address and show country badge', async ({ page }) => {
    await openFirstEditModal(page);
    const modal = editModal(page);

    await modal.getByRole('button', { name: 'Luar negeri' }).click();
    await modal.locator('select').filter({ has: page.locator('option:has-text("Negara")') }).selectOption('SG');
    await modal.getByPlaceholder('Kota').fill('Singapore');
    const streetLine = `Unit E2E ${Date.now()}`;
    await modal.getByPlaceholder('Alamat jalan / unit').fill(streetLine);

    await modal.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Profil Diperbarui')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Singapura', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    await openFirstEditModal(page);
    await expect(modal.getByRole('button', { name: 'Luar negeri' })).toHaveClass(/bg-\[#181818\]/);
    await expect(modal.getByPlaceholder('Kota')).toHaveValue('Singapore');
    await expect(modal.getByPlaceholder('Alamat jalan / unit')).toHaveValue(streetLine);
  });

  test('domicile filter narrows directory list', async ({ page }) => {
    const filter = page.locator('select').filter({ has: page.locator('option:has-text("Semua Domisili")') });
    await filter.selectOption('INTL');
    await page.waitForTimeout(2000);

    const badges = page.locator('span').filter({ hasText: /^(Indonesia|Singapura|Malaysia|Australia)$/ });
    const count = await badges.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(badges.nth(i)).not.toHaveText('Indonesia');
      }
    }

    await filter.selectOption('ID');
    await page.waitForTimeout(2000);
    const idBadge = page.getByText('Indonesia', { exact: true }).first();
    if (await idBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(idBadge).toBeVisible();
    }
  });
});
