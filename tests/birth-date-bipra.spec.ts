import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
const DEMO_USER = 'tech@gehc.demo';
const DEMO_PASSWORD = 'password123';

async function loginAsAdmin(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/local`, {
    data: { email: DEMO_USER, password: DEMO_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe('Birth date + BIPRA suggest', () => {
  test.beforeEach(async ({ request }) => {
    await loginAsAdmin(request);
  });

  test('profile accepts birthDate and returns demographics', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/me/profile`, {
      data: { birthDate: '2000-06-15', gender: 'LAKI-LAKI', phone: '081234567890' },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.user.birthDate).toBeTruthy();
    expect(data.demographics?.age).toBeGreaterThan(0);
    expect(data.demographics?.bipraSuggest?.suggested).toBeTruthy();
  });

  test('jemaat list includes demographics enrichment', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/jemaat?bipra=PEMUDA`);
    expect(res.ok()).toBeTruthy();
    const { youth } = await res.json();
    expect(Array.isArray(youth)).toBeTruthy();
    if (youth.length > 0 && youth[0].birthDate) {
      expect(youth[0].demographics).toBeTruthy();
    }
  });

  test('upcoming birthdays endpoint', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/jemaat/birthdays/upcoming?days=30`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data.birthdays)).toBeTruthy();
  });

  test('waitlist assign returns 410 deprecated', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/waitlist/wl-test/assign`, {
      data: { groupId: 'grp-1' },
    });
    expect(res.status()).toBe(410);
  });
});

test.describe('Portal nav role gating', () => {
  test('komisi can access onboarding API', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get(`${BASE_URL}/api/waiting-pool`);
    expect(res.ok()).toBeTruthy();
  });
});
