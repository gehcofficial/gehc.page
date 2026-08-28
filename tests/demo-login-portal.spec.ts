import { test, expect, Page } from '@playwright/test';

test('Full onboarding flow with demo impersonate login', async ({ page }) => {
  test.setTimeout(180000);
  
  // Step 1: Go to homepage and set up demo mode
  await page.goto('http://localhost:8787');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Step 2: Login via demo impersonate endpoint
  console.log('Logging in via demo impersonate...');
  const loginResponse = await page.request.post('http://localhost:8787/api/demo/impersonate', {
    data: { email: 'tech@gehc.demo' },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginData = await loginResponse.json();
  console.log('Logged in as:', loginData.user.name, loginData.user.email);

  // Step 3: Reload to apply auth state
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Step 4: Click the "Portal" button in navbar to switch to portal view
  const portalBtn = page.locator('button:has-text("Portal")').first();
  if (await portalBtn.isVisible({ timeout: 5000 })) {
    await portalBtn.click();
    await page.waitForTimeout(3000);
    console.log('Clicked Portal button');
  } else {
    console.log('Portal button not visible, checking for alternatives...');
    const masukBtn = page.locator('button:has-text("Masuk")');
    if (await masukBtn.isVisible({ timeout: 5000 })) {
      await masukBtn.click();
      await page.waitForTimeout(3000);
      console.log('Clicked Masuk button');
    }
  }

  // Step 5: Wait for portal sidebar to appear
  await page.waitForTimeout(3000);

  // Check if we're in portal now by looking for sidebar
  const portalSidebar = page.locator('aside, nav, [role="navigation"]');
  await portalSidebar.first().waitFor({ state: 'visible', timeout: 15000 });
  
  console.log('Portal sidebar appeared!');

  console.log('Page title after portal switch:', await page.title());

  // Check if we're in portal now
  const portalSidebarCount = await page.locator('aside, nav, [role="navigation"]').count();
  console.log('Portal sidebar found:', portalSidebarCount);

  if (portalSidebarCount > 0) {
    const links = page.locator('aside a, aside button, nav a, nav button');
    const linkCount = await links.count();
    console.log('Portal links:', linkCount);
    if (linkCount > 0) {
      const texts = await links.allTextContents();
      console.log('Portal nav items:', texts);
    }
  }

  // Take screenshot
  await page.screenshot({ path: 'debug-portal-switched.png', fullPage: true });
});