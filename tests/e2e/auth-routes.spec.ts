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
