import { test, expect } from '@playwright/test';

test.describe('Auth & event routes (hash)', () => {
  test('join tanpa query redirects ke register', async ({ page }) => {
    await page.goto('/#/join');
    await page.waitForTimeout(800);
    expect(page.url()).toContain('#/register');
  });

  test('join event=bakutau redirects ke event page', async ({ page }) => {
    await page.goto('/#/join?event=bakutau');
    await page.waitForTimeout(800);
    expect(page.url()).toContain('#/event/bakutau');
  });

  test('register page shows membership copy', async ({ page }) => {
    await page.goto('/#/register');
    await expect(page.getByRole('heading', { name: /Gabung Beyonders/i })).toBeVisible();
  });

  test('register page collects split name, church title, and academic titles', async ({ page }) => {
    await page.goto('/#/register');
    await expect(page.getByText(/Gelar jabatan struktur gereja/i)).toBeVisible();
    await expect(page.getByText(/Nama depan/i)).toBeVisible();
    await expect(page.getByText(/Nama tengah/i)).toBeVisible();
    await expect(page.getByText(/Nama belakang/i)).toBeVisible();
    await expect(page.getByText(/Gelar akademis/i)).toBeVisible();
    await page.locator('select').filter({ hasText: 'Pendeta (Pdt)' }).selectOption('PDT');
    await page.getByPlaceholder('cth. Meyke').fill('meyke');
    await page.getByPlaceholder('cth. Poluan').fill('poluan');
    await page.getByPlaceholder(/Cari S\.Th/i).fill('s.th');
    await page.getByText('Sarjana Teologi', { exact: false }).first().click();
    await page.getByPlaceholder(/Cari S\.Th/i).fill('m.pd');
    await page.getByText('Magister Pendidikan', { exact: false }).first().click();
    await expect(page.getByText('Pdt Meyke Poluan S.Th., M.Pd.,')).toBeVisible();
  });

  test('event bakutau page loads', async ({ page }) => {
    await page.goto('/#/event/bakutau');
    await expect(page.getByRole('heading', { name: /Daftar Kehadiran/i })).toBeVisible();
  });

  test('login page accepts next query param', async ({ page }) => {
    await page.goto('/#/login?next=event/bakutau');
    await expect(page.getByRole('heading', { name: /Masuk Beyonders/i })).toBeVisible();
    expect(page.url()).toContain('next=event');
  });

  test('forgot password route loads', async ({ page }) => {
    await page.goto('/#/forgot-password');
    await expect(page.getByRole('heading', { name: /Lupa kata sandi/i })).toBeVisible();
  });

  test('reset password route loads', async ({ page }) => {
    await page.goto('/#/reset-password?token=demo-token');
    await expect(page.getByRole('heading', { name: /Reset kata sandi/i })).toBeVisible();
  });

  test('events timeline page loads', async ({ page }) => {
    await page.goto('/#/events');
    await expect(page.locator('body')).toContainText(/BAKU|Event|Kegiatan|Agenda/i, { timeout: 15000 });
  });
});
