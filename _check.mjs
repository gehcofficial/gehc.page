import { chromium } from '@playwright/test';

const BASE = process.env.CHECK_BASE || 'https://staging-gehcpage.vercel.app';
const out = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

const login = await ctx.request.post(`${BASE}/api/auth/local`, { data: { email: 'tech@gehc.demo', password: 'password123' } });
out.push(`login=${login.status()}`);
const meRes = await ctx.request.get(`${BASE}/api/auth/me`);
out.push(`me=${meRes.status()}`);
const me = await meRes.json();
const ns = me.activeNamespace || 'superadmin';

await page.goto(`${BASE}/#/portal/${ns}/div-didaskalia`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
out.push('url=' + page.url());
out.push('body0=' + JSON.stringify((await page.locator('body').innerText()).slice(0, 300)));

await page.waitForFunction(() => !document.body.innerText.includes('Memulihkan sesi'), { timeout: 30000 }).catch(() => out.push('WARN: masih memulihkan sesi'));
await page.waitForTimeout(4000);

out.push('body1=' + JSON.stringify((await page.locator('body').innerText()).slice(0, 500)));
const tabs = await page.locator('[role="tab"]').allInnerTexts();
out.push('TABS=' + JSON.stringify(tabs));

const studio = page.getByRole('tab', { name: 'Studio' }).first();
if (await studio.isVisible().catch(() => false)) {
  await studio.click();
  await page.waitForTimeout(2500);
  out.push('STUDIOTABS=' + JSON.stringify(await page.locator('[role="tab"]').allInnerTexts()));
}
out.push('ERRORS=' + JSON.stringify(errors.slice(0, 6)));
await page.screenshot({ path: 'C:/Users/AISAER~1/AppData/Local/Temp/opencode/didaskalia-2.png', fullPage: false });
console.log(out.join('\n'));
await browser.close();
