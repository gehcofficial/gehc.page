import { test, expect } from '@playwright/test';
import { loginViaLocal, switchToPortal } from './helpers/portal';

test('Login via local auth and open portal', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:8787');
  await page.waitForLoadState('networkidle');

  await loginViaLocal(page);
  await switchToPortal(page);

  await expect(page.getByRole('button', { name: 'Profil saya' })).toBeVisible({ timeout: 15000 });
});
