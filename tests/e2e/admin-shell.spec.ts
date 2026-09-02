import { test, expect } from '@playwright/test';
import { loginAsOperator } from '../helpers/portal';

test.describe('admin shell', () => {
  test('operator break-glass login opens #/admin dashboard', async ({ page }) => {
    await loginAsOperator(page);
    await expect(page.getByRole('heading', { name: 'Platform Admin' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('GEHC Admin')).toBeVisible();
  });
});
