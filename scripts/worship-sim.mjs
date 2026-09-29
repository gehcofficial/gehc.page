#!/usr/bin/env node
/**
 * Simulasi skenario Mentoring Day 3 lantai (F5.2) — digerakkan lewat HTTP ke staging.
 *
 * Alur mode `both` (default):
 *   final → sesi demo yang berjalan penuh sampai CLOSED (Likert, catatan, chip)
 *   live  → sesi demo yang ditinggal RUNNING (timer jalan, word cloud parsial)
 *
 * Contoh:
 *   node scripts/worship-sim.mjs --participants 60
 *   node scripts/worship-sim.mjs --reset
 *
 * Aman: menolak host produksi kecuali --force. Data demo memakai prefiks slug
 * `demo-mentoring-3-lantai` sehingga mudah dibersihkan.
 */
import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const BASE = String(flag('base', 'https://staging-youth.gehc.page')).replace(/\/+$/, '');
const PARTICIPANTS = Number(flag('participants', 60)) || 60;
const MODE = String(flag('mode', 'both'));
const RESET = Boolean(flag('reset', false));
const FORCE = Boolean(flag('force', false));
const ADMIN_EMAIL = String(flag('admin', 'tech@gehc.demo'));
const PASSWORD = String(flag('password', 'password123'));
const SLUG_FINAL = 'demo-mentoring-3-lantai-final';
const SLUG_LIVE = 'demo-mentoring-3-lantai-live';
const PREFIX = 'demo-mentoring-3-lantai';

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

  header(name) {
    if (name.toLowerCase() === 'cookie' && this.cookies.size) {
      return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (name.toLowerCase() === 'authorization' && this.auth) return this.auth;
    return undefined;
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const cookie = this.header('cookie');
    if (cookie) headers.Cookie = cookie;
    const auth = this.header('authorization');
    if (auth) headers.Authorization = auth;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
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
      const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  get = (p) => this.request('GET', p);
  post = (p, b) => this.request('POST', p, b);
  put = (p, b) => this.request('PUT', p, b);
}

const TOPICS = ['HUBUNGAN', 'PEKERJAAN', 'KELUARGA'];
const DOMINANCE = [
  { topic: 'PEKERJAAN', weight: 0.4 },
  { topic: 'HUBUNGAN', weight: 0.35 },
  { topic: 'KELUARGA', weight: 0.25 },
];
const CHIP_WEIGHTS = [
  ['INTEGRITAS', 18],
  ['BEBAS_VALIDASI', 15],
  ['KASIH_AGAPE', 13],
  ['BEBAS_TUNTUTAN', 11],
  ['PENGAMPUNAN', 10],
  ['BUKAN_HUSTLE_CULTURE', 9],
  ['IDENTITAS_BARU', 8],
  ['PEMULIHAN_LUKA', 6],
  ['KARYA_SALIB', 5],
  ['HAMBA_TUHAN', 3],
  ['RUMAH_BAPA', 1],
  ['CORAM_DEO', 1],
];
const NOTE_TEMPLATES = {
  HUBUNGAN: [
    'Ternyata aku sering pakai topeng biar diterima. Perlu belajar berhenti cari validasi manusia.',
    'Pas disakiti, aku sulit memaafkan. Mau mulai lepaskan pembalasan dan percayakan ke Tuhan.',
    'Circle-ku ngaruh besar; aku mau lebih jujur soal pergumulanku ke mentor.',
  ],
  PEKERJAAN: [
    'Nilaiku bukan IPK atau pujian atasan. Mau stop hustle culture yang bikin aku kehilangan hadirat Tuhan.',
    'Soal kejujuran kecil di kantor: aku sadar itu bukan abu-abu. Mau pilih integritas walau rugi.',
    'Mau melihat pekerjaanku sebagai mezbah, bukan beban.',
  ],
  KELUARGA: [
    'Tekanan jadi "anak kebanggaan" menguras aku. Kasih Bapa tidak menuntut prestasi.',
    'Sulit mengasihi anggota keluarga yang toxic. Aku butuh kasih yang lebih besar dari diriku.',
    'Aku lebih terbuka ke teman daripada keluarga; mau mulai membangun rumah sebagai tempat pulang.',
  ],
  KESIMPULAN: [
    'Injil bukan sekadar berita baik — ia mengubah cara aku melihat kerja, relasi, dan keluarga.',
    'Pulang kepada Bapa hari ini terasa nyata. Mau bawa catatan ini ke minggu ini.',
    'Aku belajar bahwa pertobatan itu praktis: ada langkah kecil yang bisa aku ambil minggu ini.',
  ],
};

let rng = 20261004;
const rand = () => {
  rng = (rng * 1103515245 + 12345) % 2147483648;
  return rng / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

function dominantTopicFor(index, total) {
  const cut1 = Math.round(total * DOMINANCE[0].weight);
  const cut2 = cut1 + Math.round(total * DOMINANCE[1].weight);
  if (index < cut1) return DOMINANCE[0].topic;
  if (index < cut2) return DOMINANCE[1].topic;
  return DOMINANCE[2].topic;
}

function answersFor(dominant, items) {
  const answers = {};
  for (const item of items) {
    const isDominant = item.topicCode === dominant;
    if (isDominant) answers[item.id] = rand() < 0.6 ? 1 : 2;
    else answers[item.id] = 3 + Math.floor(rand() * 3);
  }
  return answers;
}

function chipsFor(count) {
  if (count <= 0) return [];
  const pool = [];
  for (const [code, weight] of CHIP_WEIGHTS) for (let i = 0; i < weight; i += 1) pool.push(code);
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < Math.min(3, count) && guard < 200) {
    chosen.add(pool[Math.floor(rand() * pool.length) % pool.length]);
    guard += 1;
  }
  return [...chosen];
}

async function loadParticipants(limit) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL tidak tersedia (butuh untuk memilih akun peserta).');
  const u = new URL(url);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
  const [rows] = await conn.query(
    `SELECT u.id, u.name, u.email
       FROM users u
       JOIN user_roles r ON r.user_id = u.id
      WHERE u.email LIKE '%@gehc.demo' AND r.role IN ('MENTEE','CO_MENTOR','MENTOR')
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
  const url = process.env.DATABASE_URL;
  const u = new URL(url);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
  const [sessions] = await conn.query('SELECT id, slug FROM worship_sessions WHERE slug LIKE ?', [`${PREFIX}%`]);
  let removed = { sessions: 0, responses: 0, notes: 0, votes: 0 };
  for (const s of sessions) {
    const [r1] = await conn.query('DELETE FROM worship_likert_responses WHERE session_id = ?', [s.id]);
    const [r2] = await conn.query('DELETE FROM worship_notes WHERE session_id = ?', [s.id]);
    const [r3] = await conn.query('DELETE FROM worship_chip_votes WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_chips WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_likert_items WHERE session_id = ?', [s.id]);
    await conn.query('DELETE FROM worship_sessions WHERE id = ?', [s.id]);
    removed.sessions += 1;
    removed.responses += r1.affectedRows;
    removed.notes += r2.affectedRows;
    removed.votes += r3.affectedRows;
    console.log(`  dihapus: ${s.slug}`);
  }
  await conn.end();
  console.log(
    `✓ Reset: ${removed.sessions} sesi demo (${removed.responses} jawaban, ${removed.notes} catatan, ${removed.votes} vote).`,
  );
}

async function ensureSession(admin, { slug, title, expectedCount, timerSeconds }) {
  const patterns = await admin.get('/api/worship/patterns');
  const pattern = (patterns.patterns || []).find((p) => p.code === 'POST_TO_POST');
  if (!pattern) throw new Error('Pola POST_TO_POST tidak ditemukan.');
  const sessions = await admin.get('/api/worship/sessions');
  let existing = (sessions.sessions || []).find((s) => s.slug === slug);
  if (!existing) {
    const created = await admin.post('/api/worship/sessions', {
      patternCode: 'POST_TO_POST',
      slug,
      title,
      sessionDate: '2026-10-04',
      config: { expectedCount, timerSeconds },
    });
    existing = created.session;
    console.log(`  sesi dibuat: ${slug} (kode ${existing.accessCode})`);
  } else {
    console.log(`  sesi dipakai ulang: ${slug}`);
  }
  const detail = await admin.get(`/api/worship/sessions/${existing.id}`);
  return { id: existing.id, slug, detail };
}

async function main() {
  console.log(`▶ Simulasi Mentoring Day — base ${BASE} · peserta ${PARTICIPANTS} · mode ${MODE}`);
  assertSafeBase();

  if (RESET) {
    await resetDemoSessions();
    if (MODE === 'reset') return;
  }

  const admin = new Client('admin');
  await admin.post('/api/auth/local', { login: ADMIN_EMAIL, password: PASSWORD });
  console.log(`  admin login: ${ADMIN_EMAIL}`);

  const participants = await loadParticipants(PARTICIPANTS);
  console.log(`  peserta: ${participants.length} akun @gehc.demo`);

  const runFinal = MODE === 'both' || MODE === 'final' || MODE === true;
  const runLive = MODE === 'both' || MODE === 'live';

  if (runFinal) {
    console.log('\n=== Sesi 1: skenario penuh sampai selesai ===');
    const { id, detail } = await ensureSession(admin, {
      slug: SLUG_FINAL,
      title: 'DEMO — Mentoring Day 3 Lantai (selesai)',
      expectedCount: participants.length,
      timerSeconds: 1200,
    });
    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'reset' });
    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'open-likert' });
    const fresh = await admin.get(`/api/worship/sessions/${id}`);
    const items = fresh.likertItems || [];
    const topics = fresh.session.config.topics.map((t) => t.code);
    const chipCodes = (fresh.chips || []).map((c) => c.code);
    console.log(`  soal: ${items.length} · chip: ${chipCodes.length} · topik: ${topics.join(', ')}`);

    let submitted = 0;
    for (let i = 0; i < participants.length; i += 1) {
      const p = participants[i];
      const c = new Client(p.email);
      await c.post('/api/auth/local', { login: p.email, password: PASSWORD });
      const dominant = dominantTopicFor(i, participants.length);
      await c.post('/api/worship/likert', { slug: SLUG_FINAL, answers: answersFor(dominant, items) });
      submitted += 1;
      if (submitted % 10 === 0) process.stdout.write(`\r  Likert terkirim: ${submitted}/${participants.length}`);
    }
    process.stdout.write(`\r  Likert terkirim: ${submitted}/${participants.length}\n`);

    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'start' });
    console.log('  sesi dimulai (timer 20 menit).');

    let noters = 0;
    for (let i = 0; i < participants.length; i += 1) {
      const p = participants[i];
      const c = new Client(p.email);
      await c.post('/api/auth/local', { login: p.email, password: PASSWORD });
      if (rand() < 0.2) continue;
      const dominant = dominantTopicFor(i, participants.length);
      const notes = [{ topicCode: dominant, content: pick(NOTE_TEMPLATES[dominant]) }];
      const second = topics.find((t) => t !== dominant);
      if (rand() < 0.45 && second) notes.push({ topicCode: second, content: pick(NOTE_TEMPLATES[second]) });
      if (rand() < 0.8) notes.push({ topicCode: 'KESIMPULAN', content: pick(NOTE_TEMPLATES.KESIMPULAN) });
      await c.put('/api/worship/notes', { slug: SLUG_FINAL, notes });
      noters += 1;
    }
    console.log(`  catatan terisi: ${noters}/${participants.length} peserta`);

    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'wrapup' });
    console.log('  wrap-up dipicu (Lesson Learned terbuka).');

    let chippers = 0;
    for (let i = 0; i < participants.length; i += 1) {
      if (rand() < 0.25) continue;
      const p = participants[i];
      const c = new Client(p.email);
      await c.post('/api/auth/local', { login: p.email, password: PASSWORD });
      const codes = chipsFor(3).filter((code) => chipCodes.includes(code));
      if (!codes.length) continue;
      await c.post('/api/worship/chips', { slug: SLUG_FINAL, codes });
      chippers += 1;
    }
    console.log(`  chip terkirim: ${chippers} peserta`);

    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'close' });
    const finalState = await admin.get(`/api/worship/sessions/${id}`);
    printSummary(finalState, `${BASE}/#/mentoring/${SLUG_FINAL}`);
    console.log(`  catatan tersimpan di detail: ${(finalState.notes || []).length} baris`);
  }

  if (runLive) {
    console.log('\n=== Sesi 2: skenario live (ditinggal RUNNING) ===');
    const { id } = await ensureSession(admin, {
      slug: SLUG_LIVE,
      title: 'DEMO — Mentoring Day 3 Lantai (live)',
      expectedCount: participants.length,
      timerSeconds: 1200,
    });
    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'reset' });
    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'open-likert' });
    const fresh = await admin.get(`/api/worship/sessions/${id}`);
    const items = fresh.likertItems || [];
    const chipCodes = (fresh.chips || []).map((c) => c.code);

    const liveCount = Math.round(participants.length * 0.6);
    for (let i = 0; i < liveCount; i += 1) {
      const p = participants[i];
      const c = new Client(p.email);
      await c.post('/api/auth/local', { login: p.email, password: PASSWORD });
      await c.post('/api/worship/likert', {
        slug: SLUG_LIVE,
        answers: answersFor(dominantTopicFor(i, participants.length), items),
      });
    }
    await admin.put(`/api/worship/sessions/${id}/state`, { action: 'start' });
    for (let i = 0; i < liveCount; i += 1) {
      if (rand() < 0.5) continue;
      const p = participants[i];
      const c = new Client(p.email);
      await c.post('/api/auth/local', { login: p.email, password: PASSWORD });
      const codes = chipsFor(3).filter((code) => chipCodes.includes(code));
      if (codes.length) await c.post('/api/worship/chips', { slug: SLUG_LIVE, codes }).catch(() => null);
    }
    const liveState = await admin.get(`/api/worship/sessions/${id}`);
    printSummary(liveState, `${BASE}/#/mentoring/${SLUG_LIVE}`);
  }

  console.log('\n✓ Simulasi selesai. Buka control room untuk melihat hasil:');
  console.log(`  ${BASE}/#/mentoring/${SLUG_FINAL}/kontrol`);
  console.log(`  ${BASE}/#/mentoring/${SLUG_LIVE}/layar  (kode ada di control room)`);
  console.log('  (bersihkan dengan: node scripts/worship-sim.mjs --reset)');
}

function printSummary(detail, link) {
  const rooms = [...(detail.rooms || [])].sort((a, b) => a.rank - b.rank);
  console.log('  --- ringkasan ---');
  for (const r of rooms) {
    console.log(`  rank ${r.rank}: ${r.floorLabel.padEnd(8)} ${r.label} — ${r.count} peserta (skor ${r.total})`);
  }
  const cloud = (detail.wordcloud || []).slice(0, 5);
  if (cloud.length) console.log(`  top chip: ${cloud.map((c) => `${c.label}(${c.count})`).join(', ')}`);
  console.log(`  progres: ${detail.progress.submitted}/${detail.progress.total} · status ${detail.session.status}`);
  const sample = (detail.notes || []).find((n) => n.topicCode !== 'KESIMPULAN');
  if (sample) console.log(`  contoh catatan [${sample.topicCode}] ${sample.userName}: ${sample.content.slice(0, 80)}…`);
  console.log(`  tautan: ${link}`);
}

main().catch((e) => {
  console.error(`\n✗ Gagal: ${e.message}`);
  process.exit(1);
});
