import { expect, Page } from '@playwright/test';

export const BASE_URL = 'http://localhost:8787';
export const DEMO_USER = 'tech@gehc.demo';
export const DEMO_PASSWORD = 'password123';
export const OPERATOR_USER = 'ops-staging@gehc.demo';

const LABEL_TO_ROLE: Record<string, string> = {
  Superadmin: 'SUPERADMIN',
  'Komisi Pemuda': 'KOMISI',
  'Tim Kerja': 'COMMITTEE',
  Mentor: 'MENTOR',
  'Co-Mentor': 'CO_MENTOR',
  Mentee: 'MENTEE',
  BPMJ: 'BPMJ',
  Alumni: 'ALUMNI',
};

async function pickRole(page: Page, roleLabel?: string | RegExp): Promise<{ role: string; namespace: string } | null> {
  const meRes = await page.request.get(`${BASE_URL}/api/auth/me`);
  if (!meRes.ok()) return null;
  const me = await meRes.json();
  const owned: string[] = (me.user?.roles || []).map((r: { role: string }) => r.role);
  if (!owned.length) return null;

  let role = owned[0];
  if (roleLabel) {
    if (typeof roleLabel === 'string') {
      const mapped = LABEL_TO_ROLE[roleLabel];
      if (mapped && owned.includes(mapped)) role = mapped;
    } else {
      const hit = Object.entries(LABEL_TO_ROLE).find(([label, r]) => owned.includes(r) && roleLabel.test(label));
      if (hit) role = hit[1];
    }
  } else if (me.activeRole && owned.includes(me.activeRole)) {
    role = me.activeRole;
  }

  const switchRes = await page.request.post(`${BASE_URL}/api/auth/active-role`, { data: { role } });
  if (!switchRes.ok()) return null;
  const body = await switchRes.json();
  return { role: body.activeRole, namespace: body.activeNamespace };
}

export async function loginViaLocal(page: Page, email = DEMO_USER, password = DEMO_PASSWORD) {
  const response = await page.request.post(`${BASE_URL}/api/auth/local`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Login gagal untuk ${email}: HTTP ${response.status()}`);
  }
  const me = await page.request.get(`${BASE_URL}/api/auth/me`);
  if (!me.ok()) {
    throw new Error(`Sesi tidak terbentuk setelah login ${email}`);
  }
  await page.goto(`${BASE_URL}/#/beyonders`, { waitUntil: 'domcontentloaded' });
}

/** @deprecated use loginViaLocal */
export const loginViaDemo = loginViaLocal;

export async function switchToPortal(page: Page, roleLabel?: string | RegExp) {
  const picked = await pickRole(page, roleLabel);
  if (picked) {
    await page.goto(`${BASE_URL}/#/portal/${picked.namespace}/dashboard`, { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(`${BASE_URL}/#/portal`, { waitUntil: 'domcontentloaded' });
  }

  const rolePicker = page.getByRole('heading', { name: /Pilih (Panel Kerja|ruang kerja)|Choose a workspace/i });
  if (await rolePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
    const btn = roleLabel
      ? page.locator('button').filter({ hasText: roleLabel }).first()
      : page.locator('button').filter({ hasText: '#/portal/' }).first();
    await btn.click();
    await page.waitForURL(/#\/portal\/[^/]+\//, { timeout: 30000 });
  }

  await page.getByRole('button', { name: /^(Akun Saya|My Account)$/ }).or(
    page.getByRole('button', { name: /Dashboard & (Ringkasan|Summary)/ }),
  ).first().waitFor({ state: 'visible', timeout: 30000 });

  const expand = page.getByTitle(/Buka sidebar|Expand sidebar/);
  if (await expand.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expand.click();
  }
}

const MENU_PAGE: Record<string, string> = {
  'Dashboard & Ringkasan': 'dashboard',
  'Orang & Undangan': 'people',
  'Onboarding Pipeline': 'onboarding',
  'Review Penempatan': 'jethro-placement',
  Jemaat: 'youth-gehc',
  'Kelola Hirarki': 'org-hierarchy',
  'Regenerasi Kelompok': 'jethro',
  'Kelola Warta Pemuda': 'content-weekly',
  'Kelola Agenda Kegiatan': 'content-activities',
  'Monitoring 10 Kelompok': 'groups-monitoring',
  'Akun Saya': 'account/profile',
};

function currentPortalNamespace(url: string): string {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url;
  const m = hash.match(/^\/portal\/([^/]+)/);
  return m?.[1] || 'superadmin';
}

export async function navigateToMenu(page: Page, menuText: string) {
  const expand = page.getByTitle(/Buka sidebar|Expand sidebar/);
  if (await expand.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expand.click();
  }
  const btn = page.getByRole('button', { name: menuText, exact: true });
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
  } else {
    const pageId = MENU_PAGE[menuText];
    if (!pageId) {
      await btn.click();
      return;
    }
    if (pageId.startsWith('account/')) {
      await page.goto(`${BASE_URL}/#/portal/${pageId}`, { waitUntil: 'domcontentloaded' });
    } else {
      const ns = currentPortalNamespace(page.url());
      await page.goto(`${BASE_URL}/#/portal/${ns}/${pageId}`, { waitUntil: 'domcontentloaded' });
    }
  }
  await page.waitForLoadState('domcontentloaded');
}

export async function openAccountHub(page: Page, section: 'Profil' | 'Keamanan' | 'Peran' | 'Notifikasi' = 'Profil') {
  await page.goto(`${BASE_URL}/#/portal/account/profile`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /^(Akun Saya|My Account)$/ }).waitFor({ state: 'visible', timeout: 30000 });
  if (section !== 'Profil') {
    await page.getByRole('button', { name: section, exact: true }).click();
  }
}

export async function openProfileSection(page: Page, sectionName: RegExp | string) {
  await openAccountHub(page, 'Profil');
  await page.getByRole('button', { name: sectionName }).click();
}

export function tokenFromResetUrl(url: string): string | null {
  const hashPart = url.includes('#') ? url.slice(url.indexOf('#')) : url;
  const qIdx = hashPart.indexOf('?');
  if (qIdx < 0) return null;
  return new URLSearchParams(hashPart.slice(qIdx + 1)).get('token');
}

export async function loginAsOperator(
  page: Page,
  email = OPERATOR_USER,
  password = DEMO_PASSWORD,
) {
  const response = await page.request.post(`${BASE_URL}/api/operator/auth/local`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Operator login gagal untuk ${email}: HTTP ${response.status()}`);
  }
  const me = await page.request.get(`${BASE_URL}/api/operator/auth/me`);
  if (!me.ok()) {
    throw new Error(`Sesi operator tidak terbentuk untuk ${email}`);
  }
  await page.goto(`${BASE_URL}/#/admin`, { waitUntil: 'domcontentloaded' });
}
