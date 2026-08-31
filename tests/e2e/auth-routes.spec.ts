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
    await expect(page.getByRole('heading', { name: /Portal Administrasi/i })).toBeVisible();
    expect(page.url()).toContain('next=event');
  });

  test('events page CTA opens event signup', async ({ page }) => {
    await page.goto('/#/events');
    const cta = page.getByRole('button', { name: /Gabung Waitlist|Daftar Kehadiran/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('#/event/bakutau');
  });
});
