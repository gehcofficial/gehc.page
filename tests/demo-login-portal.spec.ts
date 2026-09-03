import { test, expect } from '@playwright/test';
import { loginViaLocal, switchToPortal } from './helpers/portal';

test('Login via local auth and open portal', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:8787', { waitUntil: 'domcontentloaded' });

  await loginViaLocal(page);
  await switchToPortal(page);

  await expect(page.getByRole('button', { name: /^(Akun Saya|My Account)$/ })).toBeVisible({ timeout: 15000 });
});
