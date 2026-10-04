import { test, expect, type Page, request as baseRequest } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { getPrisma } from '../../server/db.mjs';

/**
 * Simulasi Pemilihan Pelsus 11 Okt — 5 klip video + caption Indonesia.
 * Target lokal (DB staging). Election khusus SIMULASI (prefix sim-),
 * 19 election asli tidak disentuh; bersih total di akhir.
 *
 * Jalankan: npm run pelsus:sim
 * Output: public/media/pelsus/01..05-*.webm
 */

const OUT_DIR = path.resolve('public/media/pelsus');
const ADMIN = { email: 'tech@gehc.demo', password: 'password123' };
const VOTER_A = { email: 'alvandi.saerang@gehc.demo', password: 'password123' };

let EID = '';
let ACCESS_CODE = '';
let VOTER_A_ID = '';

async function caption(page: Page, text: string) {
  // Tahan terhadap reload tak terduga (mis. pemulihan cache basi): coba ulang.
  for (let i = 0; i < 3; i++) {
    try {
      await page.evaluate((t) => {
        let el = document.getElementById('demo-caption');
        if (!el) {
          el = document.createElement('div');
          el.id = 'demo-caption';
          el.style.cssText =
            'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;' +
            'background:rgba(20,20,20,0.92);color:#fff;font:700 15px/1.35 system-ui,sans-serif;' +
            'padding:12px 18px;border-radius:999px;max-width:88%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4);pointer-events:none';
          document.body.appendChild(el);
        }
        el.textContent = t;
      }, text);
      await page.waitForTimeout(400);
      return;
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      await page.waitForTimeout(900);
    }
  }
  throw new Error(`caption gagal: ${text}`);
}

async function loginApi(req: any, email: string, password: string) {
  const r = await req.post('/api/auth/local', { data: { email, password } });
  if (!r.ok()) throw new Error(`Login API gagal ${email}: HTTP ${r.status()}`);
  const me = await req.get('/api/auth/me');
  if (!me.ok()) throw new Error(`Sesi tidak terbentuk ${email}`);
  return (await me.json()).user;
}

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Probe: server dev harus sudah memuat kode Pelsus (restart bila masih build lama).
  const probe = await request.post('/api/pelsus/elections', { data: {} });
  if (probe.status() === 404) {
    let json: any = null;
    try { json = await probe.json(); } catch { /* HTML = rute belum ada */ }
    if (!json || !json.error) {
      throw new Error('Server dev belum memuat kode Pelsus (restart: npm run dev).');
    }
  }
  await loginApi(request, ADMIN.email, ADMIN.password);
  // ID voter A dari login langsung (konteks terpisah agar cookie admin utuh).
  const voterCtx = await baseRequest.newContext({ baseURL: 'http://localhost:8787' });
  try {
    await loginApi(voterCtx, VOTER_A.email, VOTER_A.password);
    const meRes = await voterCtx.get('/api/auth/me');
    VOTER_A_ID = (await meRes.json()).user.id;
  } finally {
    await voterCtx.dispose().catch(() => null);
  }

  EID = `sim-${Date.now().toString(36)}`;
  const created = await request.post('/api/pelsus/elections', {
    data: {
      id: EID, scope: 'BIPRA', bipra: 'PEMUDA', roleTarget: 'PENATUA',
      title: 'SIMULASI — Calon Penatua Pemuda (hapus otomatis)', maxChoices: 1,
    },
  });
  if (created.status() !== 201) throw new Error(`Buat election SIMULASI gagal: HTTP ${created.status()}`);
  const body = await created.json();
  EID = body.election.id;
  ACCESS_CODE = body.election.accessCode;
  if (!EID.startsWith('sim-')) throw new Error('Guard: id election uji harus prefix sim-');
  for (const [i, name] of ['Simulasi Calon 1', 'Simulasi Calon 2', 'Simulasi Calon 3'].entries()) {
    const c = await request.post(`/api/pelsus/${EID}/candidates`, { data: { name, nomor: i + 1 } });
    if (c.status() !== 201) throw new Error(`Tambah kandidat gagal: HTTP ${c.status()}`);
  }
  const imp = await request.post(`/api/pelsus/${EID}/voters/import`, {
    data: { rows: [{ name: 'Alvandi Saerang', userId: VOTER_A_ID }, { name: 'Simulasi Bilik 1' }, { name: 'Simulasi Manual 1' }] },
  });
  if (!imp.ok()) throw new Error(`Import DPT gagal: HTTP ${imp.status()}`);
});

test.afterAll(async ({ request }) => {
  await loginApi(request, ADMIN.email, ADMIN.password).catch(() => null);
  const list = await request.get('/api/pelsus').then((r: any) => r.json()).catch(() => null);
  for (const e of list?.elections || []) {
    if (String(e.id).startsWith('sim-')) {
      await request.put(`/api/pelsus/${e.id}/state`, { data: { action: 'close' } }).catch(() => null);
      await request.delete(`/api/pelsus/${e.id}`).catch(() => null);
    }
  }
  const verify = await request.get('/api/pelsus').then((r: any) => r.json()).catch(() => null);
  const sisa = (verify?.elections || []).filter((e: any) => String(e.id).startsWith('sim-'));
  expect(sisa.length).toBe(0);
  // Nol orphan di semua tabel anak (cascade eksplisit di route DELETE).
  const prisma = getPrisma();
  if (prisma) {
    const sim = { startsWith: 'sim-' };
    const [v, b, t, a, c] = await Promise.all([
      prisma.pelsusVoter.count({ where: { electionId: sim } }),
      prisma.pelsusBallot.count({ where: { electionId: sim } }),
      prisma.pelsusKioskToken.count({ where: { electionId: sim } }),
      prisma.pelsusAuditLog.count({ where: { electionId: sim } }),
      prisma.pelsusCandidate.count({ where: { electionId: sim } }),
    ]);
    expect({ v, b, t, a, c }).toEqual({ v: 0, b: 0, t: 0, a: 0, c: 0 });
  }
});

async function adminApi(request: any) {
  await loginApi(request, ADMIN.email, ADMIN.password);
  return request;
}

test('01 panitia buka pemilihan', async ({ page }) => {
  const video = page.video();
  await loginApi(page.request, ADMIN.email, ADMIN.password);
  await page.goto('/#/pelsus');
  await caption(page, 'Panitia: daftar pemilihan — pilih surat suara SIMULASI');
  await page.getByRole('link', { name: /SIMULASI/ }).click();
  await expect(page.getByText('pilih 1 · rahasia')).toBeVisible();
  await caption(page, 'Surat suara + DPT + kuorum — buka Panel panitia');
  await page.locator('summary').filter({ hasText: 'Panel panitia' }).click();
  await caption(page, 'Tekan Buka — pemilihan dimulai');
  await page.getByRole('button', { name: 'Buka', exact: true }).click();
  await expect(page.getByText('Dibuka', { exact: true }).first()).toBeVisible();
  await caption(page, 'Pemilihan DIBUKA — jemaat boleh memilih');
  await page.waitForTimeout(800);
  await page.close();
  await video?.saveAs(path.join(OUT_DIR, '01-panitia-buka.webm'));
});

test('02 pemilih memilih via HP', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    recordVideo: { dir: 'test-results/pelsus-raw', size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  const video = page.video();
  await loginApi(ctx.request, VOTER_A.email, VOTER_A.password);
  await page.goto(`/#/pelsus/${EID}`);
  await caption(page, 'Peserta: buka surat suara BIPRA Anda');
  await page.getByRole('button', { name: /Simulasi Calon 1/ }).tap();
  await caption(page, 'Pilih 1 kandidat — Kirim (tidak dapat diubah)');
  const kirim = page.getByRole('button', { name: /Kirim pilihan/ });
  await expect(kirim).toBeEnabled();
  await kirim.tap();
  await expect(page.getByText(/sudah tercatat/i)).toBeVisible();
  await caption(page, 'Suara tersimpan ✓ — 1 orang 1 suara');
  // Bukti anti-ganda: submisi kedua (kandidat valid) ditolak 409.
  const det = await ctx.request.get(`/api/pelsus/${EID}`).then((r) => r.json());
  const cid = det.candidates?.[0]?.id;
  const dup = await ctx.request.post(`/api/pelsus/${EID}/ballot`, { data: { candidateIds: [cid] } });
  expect(dup.status()).toBe(409);
  await page.waitForTimeout(600);
  await page.close();
  await ctx.close();
  await video?.saveAs(path.join(OUT_DIR, '02-pemilih-hp.webm'));
});

test('03 bilik token tanpa login', async ({ browser, request }) => {
  await adminApi(request);
  const voters = await request.get(`/api/pelsus/${EID}/voters?unvoted=1`).then((r: any) => r.json());
  const bilik = voters.voters.find((v: any) => v.name === 'Simulasi Bilik 1');
  expect(bilik).toBeTruthy();
  const tokRes = await request.post(`/api/pelsus/${EID}/tokens`, { data: { voterId: bilik.id } });
  const tok = await tokRes.json().catch(() => ({}));
  console.log(`tokens: HTTP ${tokRes.status()} ${JSON.stringify(tok).slice(0, 160)}`);
  expect(tokRes.ok()).toBeTruthy();
  expect(tok.token?.length).toBe(6);

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    recordVideo: { dir: 'test-results/pelsus-raw', size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  const video = page.video();
  await page.goto(`/#/pelsus/${EID}/bilik`);
  await caption(page, 'Bilik: tanpa login — masukkan token 6 digit dari petugas');
  await page.getByPlaceholder(/X{6}/).fill(tok.token);
  await page.getByRole('button', { name: /Buka surat suara/ }).tap();
  await expect(page.getByText(/Halo, Simulasi Bilik 1/)).toBeVisible();
  await caption(page, 'Pilih di bilik — petugas tidak mengintip (rahasia)');
  await page.getByRole('button', { name: /Simulasi Calon 2/ }).tap();
  await page.getByRole('button', { name: /Kirim \(\d+\/\d+\)/ }).tap();
  await expect(page.getByText(/Suara tersimpan/)).toBeVisible();
  await caption(page, 'Suara tersimpan ✓ — token hangus, layar reset otomatis');
  await page.waitForTimeout(900);
  await page.close();
  await ctx.close();
  await video?.saveAs(path.join(OUT_DIR, '03-bilik-token.webm'));
});

test('04 layar kuorum lalu tutup', async ({ browser, request }) => {
  await adminApi(request);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'test-results/pelsus-raw', size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  const video = page.video();
  await page.goto(`/#/pelsus/${EID}/layar`);
  await expect(page.locator('#layar-code')).toBeVisible({ timeout: 30000 });
  await caption(page, 'Layar proyektor: masukkan kode 6 digit panitia');
  await page.locator('#layar-code').fill(ACCESS_CODE);
  await page.locator('#layar-code').press('Enter');
  await expect(page.getByText(/Kuorum/)).toBeVisible();
  await caption(page, 'Live: X dari Y sudah memilih + status kuorum (hasil disembunyikan)');
  // Validator mencatat manual + panitia menutup (perangkat panitia).
  const voters = await request.get(`/api/pelsus/${EID}/voters?unvoted=1`).then((r: any) => r.json());
  const manual = voters.voters.find((v: any) => v.name === 'Simulasi Manual 1');
  const ci = await request.post(`/api/pelsus/${EID}/checkin`, { data: { voterId: manual.id, markOnly: true } });
  expect(ci.ok()).toBeTruthy();
  await caption(page, 'Petugas validasi manual tercatat — partisipasi bertambah');
  await page.waitForTimeout(6000);
  await request.put(`/api/pelsus/${EID}/state`, { data: { action: 'close' } });
  await caption(page, 'Panitia menutup — hasil resmi dibuka');
  await expect(page.getByRole('heading', { name: /Hasil/ })).toBeVisible({ timeout: 30000 });
  await caption(page, 'Perolehan + pemenang tampil — dituang ke Berita Acara');
  await page.waitForTimeout(900);
  await page.close();
  await ctx.close();
  await video?.saveAs(path.join(OUT_DIR, '04-layar-kuorum.webm'));
});

test('05 berita acara dan bersih-bersih', async ({ page, request }) => {
  const video = page.video();
  page.on('dialog', (d) => void d.accept());
  await loginApi(page.request, ADMIN.email, ADMIN.password);
  await adminApi(request);
  await page.goto(`/#/pelsus/${EID}`);
  await page.locator('summary').filter({ hasText: 'Panel panitia' }).click();
  await caption(page, 'Panitia: unduh Berita Acara (CSV) untuk penetapan');
  const dl = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Berita Acara/ }).click(),
  ]);
  const p = await dl[0].path();
  expect(p).toBeTruthy();
  const buf = fs.readFileSync(p as string);
  expect(buf.length).toBeGreaterThan(50);
  await caption(page, 'Reset mengosongkan suara (gladi) — lalu Hapus election');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: /Hapus election/ }).click();
  await page.waitForURL(/#\/pelsus$/, { timeout: 30000 });
  await expect(page.getByRole('link', { name: /SIMULASI/ })).toHaveCount(0);
  await caption(page, 'Bersih total — staging kembali pristine ✓');
  await page.waitForTimeout(600);
  await page.close();
  await video?.saveAs(path.join(OUT_DIR, '05-berita-acara.webm'));
});
