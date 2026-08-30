import { expect, Page } from '@playwright/test';

export const BASE_URL = 'http://localhost:8787';
export const DEMO_USER = 'tech@gehc.demo';

export async function loginViaDemo(page: Page, email = DEMO_USER) {
  const response = await page.request.post(`${BASE_URL}/api/demo/impersonate`, {
    data: { email },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await page.waitForLoadState('networkidle');
}

export async function switchToPortal(page: Page) {
  const portalBtn = page.locator('button:has-text("Portal"), button:has-text("Enter Portal")').first();
  await portalBtn.waitFor({ state: 'visible', timeout: 10000 });
  await portalBtn.click();
  await page.getByRole('button', { name: 'Profil saya' }).waitFor({ state: 'visible', timeout: 15000 });
}

export async function navigateToMenu(page: Page, menuText: string) {
  await page.getByRole('button', { name: menuText, exact: true }).click();
  await page.waitForLoadState('networkidle');
}

export function addressForm(page: Page) {
  return page.locator('div.space-y-3').filter({ has: page.getByText('Domisili', { exact: true }) });
}

export async function waitWilayah(page: Page, segment: string) {
  return page.waitForResponse(
    (r) => r.url().includes(`/api/wilayah/${segment}`) && r.ok(),
    { timeout: 30000 },
  );
}

export async function waitForProvinceOptions(form: ReturnType<typeof addressForm>) {
  const provinceSelect = form.locator('select').nth(0);
  await expect(provinceSelect).not.toBeDisabled({ timeout: 20000 });
  await expect(provinceSelect.locator('option')).not.toHaveCount(1, { timeout: 20000 });
  return provinceSelect;
}
