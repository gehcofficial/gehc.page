import { test, expect } from '@playwright/test';
import { loginViaDemo, switchToPortal, navigateToMenu } from '../helpers/portal';

const ROLE_NAV: Record<string, string[]> = {
  'tech@gehc.demo': ['Profil saya', 'Dashboard & Ringkasan', 'Orang & Undangan', 'Onboarding Pipeline'],
  'stevania.hadinda@gehc.demo': ['Profil saya', 'Orang & Undangan', 'Onboarding Pipeline', 'Jemaat'],
  'theodore.kowaas@gehc.demo': ['Profil saya', 'Dashboard & Ringkasan', 'Review Penempatan', 'Kelola Warta Pemuda'],
};

test.describe('Portal nav per role', () => {
  for (const [email, expectedMenus] of Object.entries(ROLE_NAV)) {
    test(`${email} sees expected nav items`, async ({ page }) => {
      await page.goto('/');
      await loginViaDemo(page, email);
      await switchToPortal(page);

      for (const label of expectedMenus) {
        await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
    });
  }

  test('unauthorized tab click shows toast', async ({ page }) => {
    await page.goto('/');
    await loginViaDemo(page, 'theodore.kowaas@gehc.demo');
    await switchToPortal(page);
    await expect(page.getByRole('button', { name: 'Jemaat', exact: true })).toHaveCount(0);
  });
});
