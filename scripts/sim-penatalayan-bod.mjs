#!/usr/bin/env node
/**
 * Simulasi alur tautan BOD penatalayan (staging / preview Vercel).
 *
 *   node scripts/sim-penatalayan-bod.mjs --base https://gehcpage-git-....vercel.app
 */
import {
  displayServiceRoleName,
  resolveRoleKey,
  rolesForPattern,
} from '../server/lib/serving-role-catalog.mjs';
import {
  computeSlotStatus,
  effectiveScheduleStatus,
  SLOT_STATUS,
} from '../server/lib/penatalayan-slot-status.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const BASE = String(flag('base', 'https://staging-youth.gehc.page')).replace(/\/+$/, '');
const BOD_EMAIL = String(flag('bod', 'tech@gehc.demo'));
const MENTOR_EMAIL = String(flag('mentor', 'mentor1@gehc.demo'));
const MENTEE_EMAIL = String(flag('mentee', 'mentee1@gehc.demo'));
const HOD_EMAIL = String(flag('hod', 'gievara.bogar@gehc.demo'));
const PASSWORD = String(flag('password', 'password123'));
const EVENT_ID = flag('event', null);

const basicAuth = () => {
  const raw = process.env.STAGING_BASIC_AUTH || '';
  return raw ? `Basic ${Buffer.from(raw).toString('base64')}` : null;
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

class Client {
  constructor() {
    this.cookies = new Map();
    this.auth = basicAuth();
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.cookies.size) headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.auth) headers.Authorization = this.auth;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const m = /^([^=]+)=([^;]+)/.exec(c);
      if (m) this.cookies.set(m[1], m[2]);
    }
    const legacy = res.headers.get('set-cookie');
    if (legacy) {
      for (const part of legacy.split(',')) {
        const m = /^([^=]+)=([^;]+)/.exec(part.trim());
        if (m) this.cookies.set(m[1], m[2]);
      }
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return { status: res.status, data };
  }
}

async function login(client, email) {
  const r = await client.request('POST', '/api/auth/local-login', { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${r.data?.error || ''}`);
}

async function pickEvent(client) {
  if (EVENT_ID) return EVENT_ID;
  const r = await client.request('GET', '/api/events?limit=20&serviceType=SERVING_DAY');
  const list = Array.isArray(r.data?.events) ? r.data.events : r.data?.items || [];
  const upcoming = list.find((e) => e.eventDate && new Date(e.eventDate) > new Date()) || list[0];
  if (!upcoming?.id) throw new Error('Tidak ada event uji.');
  return String(upcoming.id);
}

async function main() {
  console.log(`\nSim penatalayan BOD → ${BASE}\n`);

  check('alias Liturgist → Liturgos', displayServiceRoleName('Liturgist - Ada') === 'Liturgos');
  check('resolveRoleKey MC', resolveRoleKey('MC') === 'mc');
  check('pola CREATIVE_LAB punya liturgos', rolesForPattern('CREATIVE_LAB').some((r) => r.roleKey === 'liturgos'));

  const bod = new Client();
  const mentor = new Client();
  const mentee = new Client();
  const hod = new Client();

  try {
    await login(bod, BOD_EMAIL);
    check('login BOD', true, BOD_EMAIL);
  } catch (e) {
    check('login BOD', false, String(e.message));
    return summarize(false);
  }

  let eventId;
  try {
    eventId = await pickEvent(bod);
    check('pilih event', true, eventId);
  } catch (e) {
    check('pilih event', false, String(e.message));
    return summarize(false);
  }

  const pen = await bod.request('GET', `/api/events/${eventId}/penatalayan`);
  check('GET penatalayan event', pen.status === 200, `pola=${pen.data?.worshipPatternCode || '?'}`);

  const linkRes = await bod.request('POST', '/api/penatalayan/bod-links', {
    eventId,
    patternCode: pen.data?.worshipPatternCode || 'CREATIVE_LAB',
  });
  const token = linkRes.data?.link?.token;
  check('buat tautan BOD', linkRes.status === 200 || linkRes.status === 201, linkRes.data?.error || token?.slice(0, 8));
  if (!token) return summarize(false);

  const cap = await bod.request('GET', `/api/penatalayan/bod-links/token/${token}/caption`);
  const caption = String(cap.data?.caption || '');
  check('caption WA', cap.status === 200 && caption.includes('Liturgos') && !caption.match(/@\w+/), 'role names only');

  await login(mentor, MENTOR_EMAIL);
  const sess = await mentor.request('GET', `/api/penatalayan/bod-links/token/${token}`);
  check('mentor buka sesi', sess.status === 200, `${sess.data?.slots?.length || 0} slot`);

  const emptySlots = (sess.data?.slots || []).filter((s) => s.slotStatus === 'KOSONG' && !s.optional);
  const slot1 = emptySlots[0];
  const slot2 = emptySlots[1];
  const people = await mentor.request('GET', '/api/penatalayan/people?q=mentee');
  const userId = people.data?.people?.[0]?.id;
  if (slot1 && userId) {
    const a1 = await mentor.request('POST', `/api/penatalayan/bod-links/token/${token}/assign`, {
      items: [{ roleKey: slot1.roleKey, serviceRoleId: slot1.serviceRoleId, userId }],
    });
    check('assign role 1 → Dijadwalkan', a1.status === 201 && (a1.data?.created?.length || 0) > 0);
  } else check('assign role 1', false, 'skip no slot/user');

  if (slot2 && people.data?.people?.[1]?.id) {
    const a2 = await mentor.request('POST', `/api/penatalayan/bod-links/token/${token}/assign`, {
      items: [{ roleKey: slot2.roleKey, serviceRoleId: slot2.serviceRoleId, userId: people.data.people[1].id }],
    });
    check('assign role 2', a2.status === 201);
  }

  const reqSlot = emptySlots[2] || emptySlots[0];
  if (reqSlot) {
    const rq = await mentor.request('POST', `/api/penatalayan/bod-links/token/${token}/request-division`, {
      roleKey: reqSlot.roleKey,
      serviceRoleId: reqSlot.serviceRoleId,
    });
    check('Minta ke divisi', rq.status === 201 || rq.status === 409, rq.data?.error || 'ok');
  }

  await login(hod, HOD_EMAIL);
  const inbox = await hod.request('GET', '/api/penatalayan/bod-links/division-inbox?division=LITURGIA');
  check('inbox HOD LITURGIA', inbox.status === 200, `${inbox.data?.requests?.length || 0} req`);

  try {
    await login(mentee, MENTEE_EMAIL);
    const deny = await mentee.request('GET', `/api/penatalayan/bod-links/token/${token}`);
    check('RBAC mentee ditolak', deny.status === 403, String(deny.status));
  } catch {
    check('RBAC mentee', false, 'login gagal');
  }

  const pastEnd = new Date('2020-01-01T10:00:00Z');
  const autoDone = effectiveScheduleStatus({ status: 'CONFIRMED' }, pastEnd);
  check('auto Selesai +6h', autoDone === 'DONE');
  check('slot SELESAI when DONE', computeSlotStatus({
    schedule: { status: 'DONE', userId: 'x' },
    eventEndAt: pastEnd,
  }) === SLOT_STATUS.SELESAI);

  return summarize(true);
}

function summarize(ran) {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? 'GAGAL' : 'OK'}: ${results.filter((r) => r.ok).length}/${results.length} langkah`);
  if (failed.length) {
    console.log('Gagal:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  if (!ran) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
