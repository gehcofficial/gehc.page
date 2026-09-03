import { test, expect, Page } from '@playwright/test';
import { loginViaLocal, switchToPortal as enterPortal, navigateToMenu as clickNav, BASE_URL } from './helpers/portal';

const FLOW_USER = 'stevania.hadinda@gehc.demo';

async function switchToPortal(page: Page) {
  await enterPortal(page, 'Komisi Pemuda');
}

async function waitForPortalSidebar(page: Page) {
  const portalSidebar = page.locator('aside, nav, [role="navigation"]');
  await portalSidebar.first().waitFor({ state: 'visible', timeout: 15000 });
}

async function navigateToMenu(page: Page, menuText: string) {
  await clickNav(page, menuText);
}

async function navigateToTab(page: Page, tabText: string) {
  const tab = page.locator('button').filter({ hasText: tabText });
  await tab.first().waitFor({ state: 'visible', timeout: 10000 });
  await tab.first().click();
  await page.waitForLoadState('domcontentloaded');
}

async function openYouthGehcPanel(page: Page) {
  await page.goto('about:blank');
  await loginViaLocal(page, FLOW_USER);
  await page.request.post(`${BASE_URL}/api/auth/active-role`, { data: { role: 'KOMISI' } });
  await page.goto(`${BASE_URL}/#/portal/komisi/youth-gehc`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Direktori Jemaat')).toBeVisible({ timeout: 30000 });
}

test.describe('Complete Onboarding Pipeline Flow', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await loginViaLocal(page, FLOW_USER);
    await switchToPortal(page);
    await waitForPortalSidebar(page);
  });

  test('Complete flow: Onboarding -> Jethro Review -> Youth GEHC', async ({ page }) => {
    console.log('=== Step 1: Onboarding Pipeline ===');
    await navigateToMenu(page, 'Onboarding Pipeline');
    await expect(page.getByText(/Onboarding|Menunggu|Pipeline/i).first()).toBeVisible({ timeout: 15000 });

    console.log('=== Step 2: Review Penempatan ===');
    await navigateToMenu(page, 'Review Penempatan');
    await expect(page.getByText(/Penempatan|Jethro|Batch/i).first()).toBeVisible({ timeout: 15000 });

    console.log('=== Step 3: Youth GEHC / Jemaat ===');
    await openYouthGehcPanel(page);

    console.log('=== Step 4: Beyonders tab ===');
    await navigateToTab(page, 'Beyonders');
    await expect(page.locator('button').filter({ hasText: 'Beyonders' }).first()).toBeVisible();

    console.log('=== Step 5: Tim Kerja tab ===');
    await navigateToTab(page, 'Tim Kerja');
    await expect(page.locator('button').filter({ hasText: 'Tim Kerja' }).first()).toBeVisible();

    console.log('=== FLOW COMPLETE ===');
  });
});
