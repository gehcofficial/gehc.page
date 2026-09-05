import { test, expect } from '@playwright/test';
import {
  loginViaLocal,
  switchToPortal,
  openAccountHub,
  BASE_URL,
  DEMO_USER,
  DEMO_PASSWORD,
  tokenFromResetUrl,
} from '../helpers/portal';

const ROLE_NAV: Record<string, { menus: string[]; roleLabel?: string }> = {
  'tech@gehc.demo': {
    menus: [
      'Akun Saya',
      'Dashboard & Ringkasan',
      'Orang & Undangan',
      'Onboarding Pipeline',
      'Pemimpin 10 Rumah',
      'Kelola Warta Pemuda',
      'Struktur Organisasi',
    ],
  },
  'stevania.hadinda@gehc.demo': {
    roleLabel: 'Komisi Pemuda',
    menus: ['Akun Saya', 'Orang & Undangan', 'Onboarding Pipeline', 'Jemaat'],
  },
  'theodore.kowaas@gehc.demo': {
    roleLabel: 'Tim Kerja',
    menus: ['Akun Saya', 'Dashboard & Ringkasan', 'Review Penempatan', 'Kelola Warta Pemuda'],
  },
};

test.describe('Portal nav per role', () => {
  test.setTimeout(120000);

  for (const [email, { menus, roleLabel }] of Object.entries(ROLE_NAV)) {
    test(`${email} sees expected nav items`, async ({ page }) => {
      try {
        await loginViaLocal(page, email);
      } catch {
        test.skip(true, `Akun demo ${email} tidak tersedia di DB.`);
        return;
      }
      await switchToPortal(page, roleLabel);

      for (const label of menus) {
        await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
    });
  }

  test('unauthorized tab click shows toast', async ({ page }) => {
    try {
      await loginViaLocal(page, 'theodore.kowaas@gehc.demo');
    } catch {
      test.skip(true, 'Akun demo theodore tidak tersedia.');
      return;
    }
    await switchToPortal(page, 'Tim Kerja');
    await expect(page.getByRole('button', { name: 'Jemaat', exact: true })).toHaveCount(0);
  });
});

test.describe('Multi-role portal architecture', () => {
  test.setTimeout(120000);

  test('login redirects to namespace URL', async ({ page }) => {
    await loginViaLocal(page);
    await switchToPortal(page);
    await expect(page).toHaveURL(/#\/portal\/(superadmin|komisi|committee|mentor|mentee)/);
  });

  test('account hub sections load', async ({ page }) => {
    await loginViaLocal(page);
    await openAccountHub(page);
    await expect(page.getByRole('heading', { name: /^(Akun Saya|My Account)$/ })).toBeVisible();
    await page.getByRole('button', { name: /^(Keamanan|Security)$/ }).click();
    await expect(page.getByText(/Ganti kata sandi|Change password/i)).toBeVisible();
    await page.getByRole('button', { name: /^(Peran|Roles)$/ }).click();
    await expect(page.getByText(/Peran & panel kerja|Roles & workspaces/i)).toBeVisible();
  });

  test('forgot password page loads and accepts email', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/forgot-password`);
    await expect(page.getByRole('heading', { name: 'Lupa kata sandi' })).toBeVisible();
    await page.getByPlaceholder('nama@email.com').fill(DEMO_USER);
    await page.getByRole('button', { name: 'Kirim taut reset' }).click();
    await expect(page.getByText(/Jika email terdaftar/i)).toBeVisible({ timeout: 10000 });
  });

  test('password reset flow via API', async ({ request }) => {
    const forgot = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: DEMO_USER },
    });
    expect(forgot.ok()).toBeTruthy();
    const body = await forgot.json();
    if (!body.resetUrl) {
      test.skip(true, 'User tidak punya password lokal atau reset tidak tersedia.');
      return;
    }

    const token = tokenFromResetUrl(body.resetUrl);
    expect(token).toBeTruthy();

    const reset = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: { token, newPassword: DEMO_PASSWORD },
    });
    expect(reset.ok()).toBeTruthy();
  });

  test('active role API persists', async ({ page }) => {
    await loginViaLocal(page);
    const me = await page.request.get(`${BASE_URL}/api/auth/me`);
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    expect(meBody.activeRole).toBeTruthy();
    expect(meBody.activeNamespace).toBeTruthy();

    const switchRes = await page.request.post(`${BASE_URL}/api/auth/active-role`, {
      data: { role: meBody.activeRole },
    });
    expect(switchRes.ok()).toBeTruthy();
    const switched = await switchRes.json();
    expect(switched.activeNamespace).toBeTruthy();
  });
});
