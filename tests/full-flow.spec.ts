import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
const DEMO_USER = 'tech@gehc.demo';

async function loginViaDemo(page: Page) {
  const response = await page.request.post(`${BASE_URL}/api/demo/impersonate`, {
    data: { email: DEMO_USER },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  console.log('Logged in as:', data.user.name);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function switchToPortal(page: Page) {
  const portalBtn = page.locator('button:has-text("Portal")').first();
  if (await portalBtn.isVisible({ timeout: 5000 })) {
    await portalBtn.click();
    await page.waitForTimeout(3000);
  }
}

async function waitForPortalSidebar(page: Page) {
  const portalSidebar = page.locator('aside, nav, [role="navigation"]');
  await portalSidebar.first().waitFor({ state: 'visible', timeout: 15000 });
}

async function navigateToMenu(page: Page, menuText: string) {
  // Menu items may have extra whitespace or icons, use partial match
  const link = page.locator('aside a, aside button, nav a, nav button').filter({ hasText: menuText });
  await link.first().click();
  await page.waitForTimeout(2000);
}

async function navigateToTab(page: Page, tabText: string) {
  // Tab text includes counts like "Menunggu Profil (4)", so use partial match
  const tab = page.locator('button').filter({ hasText: tabText });
  await tab.first().waitFor({ state: 'visible', timeout: 10000 });
  await tab.first().click();
  await page.waitForTimeout(2000);
}

test.describe('Complete Onboarding Pipeline Flow', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    await loginViaDemo(page);
    await switchToPortal(page);
    await waitForPortalSidebar(page);
  });

  test('Complete flow: Onboarding -> Jethro Review -> Youth GEHC', async ({ page }) => {
    console.log('=== Step 1: Navigate to Onboarding Pipeline ===');
    await navigateToMenu(page, 'Onboarding Pipeline');
    await page.waitForTimeout(3000);

    // Go directly to Menunggu Role tab
    await navigateToTab(page, 'Menunggu Role');
    await page.waitForTimeout(3000);

    // Check for eligible entries
    const entries = page.locator('[data-testid="pending-entry"], .bg-white.rounded-2xl').filter({ hasText: /Joshua|Metha|Christo|Gracella/ });
    const entryCount = await entries.count();
    console.log(`Found ${entryCount} eligible entries in Menunggu Role`);

    if (entryCount > 0) {
      // Test single Beyonders assignment
      console.log('=== Step 2: Assign first entry as Beyonders ===');
      const firstEntry = entries.first();
      const beyondersBtn = firstEntry.locator('button').filter({ hasText: /Beyonders/ });
      if (await beyondersBtn.isVisible({ timeout: 5000 })) {
        await beyondersBtn.click();
        await page.waitForTimeout(3000);
        console.log('Beyonders assigned for first entry');
      } else {
        console.log('Beyonders button not found for first entry');
      }

      // Test single Individu assignment
      console.log('=== Step 3: Assign second entry as Individu ===');
      const secondEntry = entries.nth(1);
      const individuBtn = secondEntry.locator('button').filter({ hasText: /Individu/ });
      if (await individuBtn.isVisible({ timeout: 5000 })) {
        await individuBtn.click();
        await page.waitForTimeout(3000);
        console.log('Individu assigned for second entry');
      }
    }

    // Test bulk select
    console.log('=== Step 4: Bulk select and assign Beyonders ===');
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    if (await selectAllCheckbox.isVisible({ timeout: 5000 })) {
      await selectAllCheckbox.check();
      await page.waitForTimeout(500);
      
      const bulkBeyonders = page.locator('button').filter({ hasText: /Beyonders/ }).nth(1);
      if (await bulkBeyonders.isVisible({ timeout: 5000 })) {
        await bulkBeyonders.click();
        await page.waitForTimeout(5000);
        console.log('Bulk Beyonders assigned');
      }
    }

    // Navigate to Jethro Placement Review
    console.log('=== Step 5: Navigate to Jethro Placement Review ===');
    await navigateToMenu(page, 'Jethro Placement Review');
    await page.waitForTimeout(3000);

    // Check for batch
    const batchSelect = page.locator('select').first();
    if (await batchSelect.isVisible({ timeout: 5000 })) {
      console.log('Batch selector found');
    }

    // Click Analisis AI
    console.log('=== Step 6: Click Analisis AI ===');
    const aiBtn = page.locator('button').filter({ hasText: /Analisis AI/ });
    if (await aiBtn.isVisible({ timeout: 5000 })) {
      await aiBtn.click();
      await page.waitForTimeout(10000);
      console.log('AI Analysis triggered');

      // Check for AI result
      const aiResult = page.locator('text=Analisis AI Jethro, .prose, [class*="prose"]');
      if (await aiResult.isVisible({ timeout: 15000 })) {
        console.log('AI Analysis result displayed');
        const text = await aiResult.textContent();
        console.log('AI Analysis preview:', text?.substring(0, 200));
      }
    }

    // Commit to Youth GEHC
    console.log('=== Step 7: Commit to Youth GEHC ===');
    const commitBtn = page.locator('button').filter({ hasText: /Commit ke Youth GEHC/ });
    if (await commitBtn.isVisible({ timeout: 5000 })) {
      await commitBtn.click();
      await page.waitForTimeout(5000);
      console.log('Commit triggered');
    }

    // Navigate to Youth GEHC
    console.log('=== Step 8: Navigate to Youth GEHC ===');
    await navigateToMenu(page, 'Youth GEHC');
    await page.waitForTimeout(3000);

    // Check Beyonders tab
    console.log('=== Step 9: Check Beyonders tab ===');
    await navigateToTab(page, 'Beyonders');
    await page.waitForTimeout(2000);

    // Check for groups
    const groupNames = ['Avodah', 'Agape', 'Shalom', 'Hesed', 'Kairos', 'Logos', 'Metanoia', 'Koinonia', 'Diakonia', 'Marturia'];
    for (const groupName of groupNames) {
      const groupHeader = page.locator(`text=${groupName}`).first();
      if (await groupHeader.isVisible({ timeout: 5000 })) {
        console.log(`Group "${groupName}" found`);
      }
    }

    // Check for pending indicator
    const pendingBadge = page.locator('text=Menunggu Review');
    const pendingCount = await pendingBadge.count();
    console.log(`Found ${pendingCount} pending badges`);

    // Check Tim Kerja tab
    console.log('=== Step 10: Check Tim Kerja tab ===');
    await navigateToTab(page, 'Tim Kerja');
    await page.waitForTimeout(2000);

    // Check for BOD, Panca Tugas, Benzarpreneurship sub-tabs
    const subTabs = ['BOD', 'Panca Tugas', 'Benzarpreneurship'];
    for (const subTab of subTabs) {
      const subTabBtn = page.locator('button').filter({ hasText: new RegExp(`^${subTab}$`) });
      if (await subTabBtn.isVisible({ timeout: 5000 })) {
        console.log(`Sub-tab "${subTab}" found`);
      }
    }

    // Check Komisi tab
    console.log('=== Step 11: Check Komisi tab ===');
    await navigateToTab(page, 'Komisi');
    await page.waitForTimeout(2000);

    // Check for position sub-tabs
    const komisiPositions = ['Ketua Komisi', 'Wakil Ketua Komisi', 'Sekretaris', 'Anggota'];
    for (const pos of komisiPositions) {
      const posBtn = page.locator('button').filter({ hasText: new RegExp(`^${pos}$`) });
      if (await posBtn.isVisible({ timeout: 5000 })) {
        console.log(`Komisi position "${pos}" found`);
      }
    }

    // Check BPMJ tab
    console.log('=== Step 12: Check BPMJ tab ===');
    await navigateToTab(page, 'BPMJ');
    await page.waitForTimeout(2000);

    const bpmjPositions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'];
    for (const pos of bpmjPositions) {
      const posBtn = page.locator('button').filter({ hasText: new RegExp(`^${pos}$`) });
      if (await posBtn.isVisible({ timeout: 5000 })) {
        console.log(`BPMJ position "${pos}" found`);
      }
    }

    console.log('=== FLOW COMPLETE ===');
  });
});