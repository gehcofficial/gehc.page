#!/usr/bin/env node
/**
 * Simulasi sinkronisasi BEDAH_FILM (M0 → M1 → M3 → M4) — digerakkan lewat HTTP ke staging.
 *
 * Memvalidasi alur tim tahapan film (tanpa timer sesi penuh):
 *   M0 buka Likert AWAL + timer langkah 5' → M1 kunci AWAL + tandai film tayang
 *   → M3 buka Likert AKHIR + Lesson Learned + timer 5' + hentikan marker
 *   → M4 wrapup + timer Undi & Kesaksian 10'.
 *
 * Yang diperiksa tiap langkah (payload /live & /session):
 *   phase (nama + durasi), likertRounds (gate AWAL/AKHIR), screening.startedAt,
 *   likertMeans (delta pre→post), wordcloud, status sesi.
 *
 * Contoh:
 *   node scripts/film-sim.mjs                 # skenario penuh sampai CLOSED
 *   node scripts/film-sim.mjs --stop m1       # berhenti di M1 (RUNNING, siap dicek manual)
 *   node scripts/film-sim.mjs --reset         # hapus sesi demo sim
 *
 * Aman: menolak host produksi kecuali --force. Data demo berprefiks slug
 * `demo-bedah-film-sim` sehingga mudah dibersihkan.
 */
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.staging'), override: true });
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const BASE = String(flag('base', 'https://staging-youth.gehc.page')).replace(/\/+$/, '');
const USERS = Number(flag('users', 3)) || 3;
const RESET = Boolean(flag('reset', false));
const FORCE = Boolean(flag('force', false));
const STOP = String(flag('stop', 'done')).toLowerCase();
const ADMIN_EMAIL = String(flag('admin', 'tech@gehc.demo'));
const PASSWORD = String(flag('password', 'password123'));
const TEMPLATE_SLUG = String(flag('template', 'sesi-2026-10-17-bedah-film'));
const SLUG = String(flag('slug', 'demo-bedah-film-sim-utama'));
const PREFIX = 'demo-bedah-film-sim';
const FILM_TITLE = 'The Case for Christ (2017, 112 menit — tayang versi ringkas)';
const FILM_MIN = 112;

const basicAuth = () => {
  const raw = process.env.STAGING_BASIC_AUTH || '';
  return raw ? `Basic ${Buffer.from(raw).toString('base64')}` : null;
};

function assertSafeBase() {
  const host = new URL(BASE).hostname;
  const isStaging =
    host === 'localhost' ||
    host.startsWith('127.0.0.1') ||
    host === 'staging.gehc.page' ||
    /^staging-[a-z]+\.gehc\.page$/.test(host) ||
    host.endsWith('.vercel.app');
  if (!isStaging && !FORCE) {
    throw new Error(`Host "${host}" bukan staging. Gunakan --force bila benar-benar disengaja.`);
  }
}

class Client {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
    this.auth = basicAuth();
  }

  async request(method, endpoint, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (this.auth) headers.Authorization = this.auth;
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.error || text.slice(0, 160) || `HTTP ${res.status}`;
      throw new Error(`${method} ${endpoint} → ${res.status}: ${msg}`);
    }
    return json;
  }

  get = (p) => this.request('GET', p);
  post = (p, b) => this.request('POST', p, b);
  put = (p, b) => this.request('PUT', p, b);
}

let failures = 0;
const check = (label, cond, detail = '') => {
  if (!cond) failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function dbClient() {
  const url = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_STAGING/DATABASE_URL tidak tersedia (butuh untuk akun demo).');
  const u = new URL(url);
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
}

async function loadParticipants(limit) {
  const conn = await dbClient();
  const [rows] = await conn.query(
    `SELECT u.id, u.name, u.email
       FROM users u
       JOIN user_roles r ON r.user_id = u.id
      WHERE u.email LIKE '%@gehc.demo' AND u.password_hash IS NOT NULL
        AND r.role IN ('MENTEE','CO_MENTOR','MENTOR')
      GROUP BY u.id, u.name, u.email
      ORDER BY u.email
      LIMIT ?`,
    [limit],
  );
  await conn.end();
  if (!rows.length) throw new Error('Tidak ada akun @gehc.demo di DB ini.');
  return rows;
}

async function resetDemoSessions() {
  const conn = await dbClient();
  const [sessions] = await conn.query('SELECT id, slug FROM worship_sessions WHERE slug LIKE ?', [`${PREFIX}%`]);
  let removed = 0;
  for (const s of sessions) {
    await conn.query('DELETE FROM worship_likert_responses WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_notes WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_chip_votes WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_chips WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_likert_items WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_sessions WHERE id = ?', [s.id]);
    removed += 1;
    console.log(`  dihapus: ${s.slug}`);
  }
  await conn.end();
  console.log(`✓ Reset: ${removed} sesi demo film.`);
}

async function ensureSession(admin, expectedCount) {
  const template = await admin.get(`/api/worship/sessions/${TEMPLATE_SLUG}`).catch(() => null);
  if (!template?.session) throw new Error(`Template ${TEMPLATE_SLUG} tidak ditemukan (isi lebih dulu di staging).`);
  const templateConfig = template.session.config || {};
  const items = template.likertItems || [];
  const chips = template.chips || [];
  if (!items.some((i) => String(i.topicCode).toUpperCase() === 'FILM_PRE') || !items.some((i) => String(i.topicCode).toUpperCase() === 'FILM_POST')) {
    throw new Error(`Template ${TEMPLATE_SLUG} tidak punya soal FILM_PRE/FILM_POST.`);
  }

  const sessions = await admin.get('/api/worship/sessions');
  let existing = (sessions.sessions || []).find((x) => x.slug === SLUG);
  if (!existing) {
    const created = await admin.post('/api/worship/sessions', {
      patternCode: 'BEDAH_FILM',
      slug: SLUG,
      title: 'DEMO — Bedah Film (sim sinkronisasi M0–M4)',
      sessionDate: '2026-10-17',
      config: { ...templateConfig, timerSeconds: 10800, expectedCount },
    });
    existing = created.session;
    console.log(`  sesi dibuat: ${SLUG} (kode ${existing.accessCode})`);
  } else {
    console.log(`  sesi dipakai ulang: ${SLUG}`);
  }

  let detail = await admin.get(`/api/worship/sessions/${existing.id}`);
  if (!(detail.likertItems || []).length) {
    for (const item of items) {
      await admin.post(`/api/worship/sessions/${existing.id}/likert-items`, {
        topicCode: item.topicCode,
        text: item.text,
        gospelNote: item.gospelNote,
        sortOrder: item.sortOrder,
      });
    }
    console.log(`  soal disalin dari ${TEMPLATE_SLUG}: ${items.length}`);
  }
  if (!(detail.chips || []).length && chips.length) {
    for (const chip of chips) {
      await admin.post(`/api/worship/sessions/${existing.id}/chips`, {
        code: chip.code,
        label: chip.label,
        topicCode: chip.topicCode,
        sortOrder: chip.sortOrder,
      });
    }
    console.log(`  chip disalin dari ${TEMPLATE_SLUG}: ${chips.length}`);
  }
  detail = await admin.get(`/api/worship/sessions/${existing.id}`);
  return { id: existing.id, slug: SLUG, detail };
}

const loginCache = new Map();
async function clientFor(email) {
  if (loginCache.has(email)) return loginCache.get(email);
  const c = new Client(email);
  await c.post('/api/auth/local', { login: email, password: PASSWORD });
  loginCache.set(email, c);
  return c;
}

const preAnswers = (i, ids) => Object.fromEntries(ids.map((id, k) => [id, ((i + k) % 5) + 1]));
const postAnswers = (i, ids) => Object.fromEntries(ids.map((id, k) => [id, Math.min(5, ((i * 2 + k + 3) % 5) + 1)]));

async function main() {
  console.log(`▶ Simulasi BEDAH_FILM M0–M4 — base ${BASE} · peserta ${USERS} · stop ${STOP}`);
  assertSafeBase();

  if (RESET) {
    await resetDemoSessions();
    if (STOP === 'reset' || args.includes('--reset-only')) return;
  }

  const admin = new Client('admin');
  await admin.post('/api/auth/local', { login: ADMIN_EMAIL, password: PASSWORD });
  console.log(`  admin login: ${ADMIN_EMAIL}`);

  const participants = await loadParticipants(USERS);
  const latecomer = participants[participants.length - 1];
  const onTime = participants.slice(0, -1);
  console.log(`  peserta: ${participants.length} akun (telat: ${latecomer.email})`);

  const { id, slug, detail } = await ensureSession(admin, participants.length);
  const preIds = (detail.likertItems || []).filter((i) => String(i.topicCode).toUpperCase() === 'FILM_PRE').map((i) => i.id);
  const postIds = (detail.likertItems || []).filter((i) => String(i.topicCode).toUpperCase() === 'FILM_POST').map((i) => i.id);
  const chipCodes = (detail.chips || []).map((c) => c.code);
  console.log(`  soal: ${preIds.length} AWAL + ${postIds.length} AKHIR · chip: ${chipCodes.length}`);

  // ---- Reset + pasang screening ----
  await admin.put(`/api/worship/sessions/${id}/state`, { action: 'reset' });
  await admin.put(`/api/worship/sessions/${id}/stage`, { screening: { title: FILM_TITLE, durationMin: FILM_MIN, startedAt: null } });
  let live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== Preparasi ===');
  check('status DRAFT', live.session.status === 'DRAFT', live.session.status);
  check('screening terpasang tanpa marker', live.screening?.title === FILM_TITLE && !live.screening?.startedAt);

  // ---- M0: buka Likert AWAL + timer langkah 5' ----
  await admin.put(`/api/worship/sessions/${id}/state`, { action: 'open-likert' });
  const m0At = new Date().toISOString();
  await admin.put(`/api/worship/sessions/${id}/stage`, {
    likertRounds: { pre: 'open', post: 'closed' },
    phase: { name: 'M0', startedAt: m0At, durationSec: 300, showOnScreen: true },
  });
  live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== M0 · Likert AWAL (5\') ===');
  check('phase M0 300s', live.phase?.name === 'M0' && live.phase?.durationSec === 300, `${live.phase?.name}/${live.phase?.durationSec}`);
  check('gate AWAL terbuka, AKHIR tertutup', live.likertRounds?.pre === 'open' && live.likertRounds?.post === 'closed', JSON.stringify(live.likertRounds));
  check('marker tayang belum menyala', !live.screening?.startedAt);
  const p0 = await clientFor(onTime[0].email);
  const me0 = await p0.get(`/api/worship/session/${slug}`);
  check('peserta melihat ronde AWAL terbuka', me0.likert?.rounds?.pre === 'open' && me0.likert?.open === true);
  for (let i = 0; i < onTime.length; i += 1) {
    await (await clientFor(onTime[i].email)).post('/api/worship/likert', { slug, answers: preAnswers(i, preIds), round: 'PRE' });
  }
  live = await admin.get(`/api/worship/live/${slug}`);
  const preAnswersExpected = onTime.length * preIds.length;
  check(
    'jawaban AWAL masuk (peserta telat belum ikut)',
    live.likertMeans?.pre?.n === preAnswersExpected,
    `${live.likertMeans?.pre?.n}/${preAnswersExpected} jawaban (${onTime.length} peserta × ${preIds.length})`,
  );
  if (STOP === 'm0') return finish(slug, detail);

  // ---- M1: kunci AWAL + marker tayang otomatis (mengikuti kontrol) ----
  await admin.put(`/api/worship/sessions/${id}/state`, { action: 'start' });
  await admin.put(`/api/worship/sessions/${id}/stage`, {
    likertRounds: { pre: 'closed', post: 'closed' },
    phase: null,
    screening: { title: FILM_TITLE, durationMin: FILM_MIN, startedAt: new Date().toISOString() },
  });
  live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== M1 · Mulai Film ===');
  check('status RUNNING', live.session.status === 'RUNNING', live.session.status);
  check('phase dimatikan (film tanpa countdown)', live.phase === null || live.phase === undefined);
  check('marker ● Sedang diputar menyala', Boolean(live.screening?.startedAt));
  check('gate AWAL terkunci', live.likertRounds?.pre === 'closed', JSON.stringify(live.likertRounds));
  const pl = await clientFor(latecomer.email);
  const mel = await pl.get(`/api/worship/session/${slug}`);
  check('peserta telat melihat gate AWAL terkunci (input untuk lanjut nonton)', mel.likert?.rounds?.pre === 'closed');
  if (STOP === 'm1') return finish(slug, detail);

  // ---- M3: buka Likert AKHIR + Lesson Learned + timer 5' + hentikan marker ----
  await admin.put(`/api/worship/sessions/${id}/stage`, {
    likertRounds: { pre: 'closed', post: 'open' },
    phase: { name: 'M3', startedAt: new Date().toISOString(), durationSec: 300, showOnScreen: true },
    screening: { title: FILM_TITLE, durationMin: FILM_MIN, startedAt: null },
  });
  live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== M3 · Likert AKHIR + Lesson Learned (5\') ===');
  check('phase M3 300s', live.phase?.name === 'M3' && live.phase?.durationSec === 300, `${live.phase?.name}/${live.phase?.durationSec}`);
  check('gate AKHIR terbuka di /live (field baru likertRounds)', live.likertRounds?.post === 'open', JSON.stringify(live.likertRounds));
  check('marker tayang padam', !live.screening?.startedAt);
  for (let i = 0; i < participants.length; i += 1) {
    await (await clientFor(participants[i].email)).post('/api/worship/likert', { slug, answers: postAnswers(i, postIds), round: 'POST' });
  }
  for (let i = 0; i < onTime.length; i += 1) {
    const codes = chipCodes.slice(0, Math.min(3, chipCodes.length));
    if (codes.length) await (await clientFor(onTime[i].email)).post('/api/worship/chips', { slug, codes });
  }
  live = await admin.get(`/api/worship/live/${slug}`);
  const postAnswersExpected = participants.length * postIds.length;
  check(
    'jawaban AKHIR masuk (termasuk peserta telat)',
    live.likertMeans?.post?.n === postAnswersExpected,
    `${live.likertMeans?.post?.n}/${postAnswersExpected} jawaban (${participants.length} peserta × ${postIds.length})`,
  );
  check('delta awal → akhir terhitung', live.likertMeans?.delta != null, String(live.likertMeans?.delta));
  check('wordcloud Lesson Learned terisi', (live.wordcloud || []).length > 0, `${(live.wordcloud || []).length} chip`);
  if (STOP === 'm3') return finish(slug, detail);

  // ---- M4: wrapup + timer Undi & Kesaksian 10' ----
  await admin.put(`/api/worship/sessions/${id}/state`, { action: 'wrapup' });
  await admin.put(`/api/worship/sessions/${id}/stage`, {
    phase: { name: 'M4', startedAt: new Date().toISOString(), durationSec: 600, showOnScreen: true },
  });
  live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== M4 · Undi + Kesaksian (10\') ===');
  check('status WRAPUP', live.session.status === 'WRAPUP', live.session.status);
  check('phase M4 600s', live.phase?.name === 'M4' && live.phase?.durationSec === 600, `${live.phase?.name}/${live.phase?.durationSec}`);
  if (STOP === 'm4') return finish(slug, detail);

  await admin.put(`/api/worship/sessions/${id}/state`, { action: 'close' });
  live = await admin.get(`/api/worship/live/${slug}`);
  console.log('\n=== Tutup ===');
  check('status CLOSED', live.session.status === 'CLOSED', live.session.status);
  return finish(slug, detail);
}

function finish(slug, detail) {
  const code = detail?.session?.accessCode || '••••••';
  console.log('\n--- ringkasan ---');
  console.log(`  progres akhir: ${failures === 0 ? 'semua assert LULUS ✓' : `${failures} assert GAGAL ✗`}`);
  console.log('  tautan cek manual (akun demo, sandi password123):');
  console.log(`    kontrol : ${BASE}/#/mentoring/${slug}/kontrol`);
  console.log(`    layar   : ${BASE}/#/mentoring/${slug}/layar  (kode sesi: ${code})`);
  console.log(`    peserta : ${BASE}/#/mentoring/${slug}`);
  console.log(`  bersihkan: node scripts/film-sim.mjs --reset`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\n✗ Gagal: ${e.message}`);
  process.exit(1);
});
