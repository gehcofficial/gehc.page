/**
 * QA keamanan direktori publik + tenant join vs staging/preview/prod.
 *
 *   STAGING_BASIC_AUTH='user:pass' \
 *   BASE_URL=https://staging-youth.gehc.page \
 *   EXPECT_COMMIT=7e5a593 \
 *   node scripts/qa-security-directory.mjs
 *
 * Host unit (teen/men/…): QA_HOSTS=staging-youth.gehc.page,staging-teen.gehc.page
 * Preview Vercel: BASE_URL=https://gehcpage-xxxx-gehc.vercel.app (Host header tidak dipakai;
 *   gunakan alias staging-youth.gehc.page sebagai BASE_URL bila sudah di-sync).
 *
 * Prod tanpa fix (baseline): BASE_URL=https://youth.gehc.page ALLOW_PII=1 (hanya laporan).
 */
import {
  assertNoPublicPii,
  memberHasContact,
  tenantIdsInGroups,
} from './lib/qa-security-scan.mjs';

const BASE = (process.env.BASE_URL || 'https://staging-youth.gehc.page').replace(/\/$/, '');
const BASIC = process.env.STAGING_BASIC_AUTH || '';
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';
const EXPECT_COMMIT = (process.env.EXPECT_COMMIT || '').trim();
const ALLOW_PII = process.env.ALLOW_PII === '1';
const QA_HOSTS = (process.env.QA_HOSTS || 'staging-youth.gehc.page,staging-teen.gehc.page')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MENTOR_EMAIL = process.env.QA_MENTOR_EMAIL || 'stevania.hadinda@gehc.demo';
const MENTEE_EMAIL = process.env.QA_MENTEE_EMAIL || 'glenity.siauw@gehc.demo';

let pass = 0;
let fail = 0;
let skip = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function skipped(name, reason) {
  skip += 1;
  console.log(`  ○ ${name} (skip: ${reason})`);
}

function basicHeaders() {
  const h = {};
  if (BASIC) h.Authorization = 'Basic ' + Buffer.from(BASIC).toString('base64');
  if (BYPASS) h['x-vercel-protection-bypass'] = BYPASS;
  return h;
}

async function req(method, path, { host = null, session = null, body = undefined } = {}) {
  const headers = { ...basicHeaders() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers.Cookie = session;
  const origin = host && host.includes('.gehc.page') ? `https://${host}` : BASE;
  const url = path.startsWith('http') ? path : origin + path;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, data, setCookie, text };
}

async function login(email, password = DEMO_PASSWORD) {
  const r = await req('POST', '/api/auth/local', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.data)}`);
  const m = /gehc_session=[^;]+/.exec(r.setCookie);
  if (!m) throw new Error(`login ${email}: cookie sesi tidak ada`);
  return m[0];
}

async function anonPublicSuite(hostLabel, host) {
  console.log(`\n— Anon PII (${hostLabel}) —`);
  const groupsR = await req('GET', '/api/db/groups', { host });
  check(`${hostLabel} GET /api/db/groups → 200`, groupsR.status === 200, String(groupsR.status));
  if (groupsR.status !== 200) return null;

  const pii = assertNoPublicPii(groupsR.data, 'groups');
  if (ALLOW_PII && pii.findings.length) {
    skipped(`${hostLabel} groups bebas PII`, `ALLOW_PII: ${pii.findings.slice(0, 3).join(', ')}`);
  } else {
    check(`${hostLabel} groups bebas PII`, pii.ok, pii.findings.slice(0, 5).join('; '));
  }

  const tenants = tenantIdsInGroups(groupsR.data?.groups);
  if (hostLabel.includes('teen')) {
    const bad = tenants.filter((t) => t !== 'tenant-teen' && t !== 'tenant-jemaat');
    check(`${hostLabel} groups hanya tenant-teen/jemaat`, bad.length === 0, bad.join(', '));
  }
  if (hostLabel.includes('youth')) {
    const bad = tenants.filter((t) => t !== 'tenant-youth' && t !== 'tenant-jemaat');
    check(`${hostLabel} groups hanya tenant-youth/jemaat`, bad.length === 0, bad.join(', '));
  }

  const g0 = groupsR.data?.groups?.[0];
  if (g0?.id) {
    const memR = await req('GET', `/api/db/groups/${g0.id}/members`, { host });
    check(`${hostLabel} GET members → 200`, memR.status === 200);
    const mpii = assertNoPublicPii(memR.data, 'members');
    if (ALLOW_PII && mpii.findings.length) {
      skipped(`${hostLabel} members bebas PII`, `ALLOW_PII: ${mpii.findings.length} temuan`);
    } else {
      check(`${hostLabel} members bebas PII`, mpii.ok, mpii.findings.slice(0, 5).join('; '));
    }
  }

  const stR = await req('GET', '/api/db/struktur', { host });
  check(`${hostLabel} GET struktur → 200`, stR.status === 200);
  const spii = assertNoPublicPii(stR.data, 'struktur');
  if (ALLOW_PII && spii.findings.length) {
    skipped(`${hostLabel} struktur bebas PII`, `ALLOW_PII`);
  } else {
    check(`${hostLabel} struktur bebas PII`, spii.ok, spii.findings.slice(0, 5).join('; '));
  }

  return groupsR.data?.groups || [];
}

async function pastoralSuite(host, groups) {
  console.log('\n— Mentor vs mentee —');
  let mentorCookie;
  let menteeCookie;
  try {
    mentorCookie = await login(MENTOR_EMAIL);
    menteeCookie = await login(MENTEE_EMAIL);
  } catch (e) {
    skipped('login demo', e.message);
    return;
  }

  const fullR = await req('GET', '/api/db/groups/full', { host, session: mentorCookie });
  check('mentor GET /api/db/groups/full → 200', fullR.status === 200, String(fullR.status));
  const mentorGroupIds = (fullR.data?.groups || [])
    .filter((g) => (g.members || []).some((m) => memberHasContact(m)))
    .map((g) => g.id);
  check('mentor punya ≥1 grup dengan kontak anggota', mentorGroupIds.length >= 1);

  const other = (groups || fullR.data?.groups || []).find((g) => !mentorGroupIds.includes(g.id));
  if (other && fullR.data?.groups) {
    const og = fullR.data.groups.find((x) => x.id === other.id);
    const leaked = (og?.members || []).some((m) => memberHasContact(m));
    check('grup lain di /full tanpa kontak mentee', !leaked, other.id);
  }

  const targetGroup = mentorGroupIds[0] || groups?.[0]?.id;
  if (targetGroup) {
    const attM = await req('GET', `/api/db/groups/${targetGroup}/attendance`, {
      host,
      session: menteeCookie,
    });
    check('mentee GET attendance → 403', attM.status === 403, String(attM.status));
  }
}

async function eventAuthSuite(host) {
  console.log('\n— Event meetings / ICS / penatalayan (anon) —');
  const evR = await req('GET', '/api/events', { host });
  if (evR.status !== 200) {
    skipped('daftar event', `status ${evR.status}`);
    return;
  }
  const ev = (evR.data?.events || evR.data || []).find?.((e) => e.id) || evR.data?.events?.[0];
  const eventId = ev?.id;
  const meetingId = ev?.meetings?.[0]?.id;
  if (!eventId) {
    skipped('event id', 'tidak ada event');
    return;
  }

  const meetR = await req('GET', `/api/events/${eventId}/meetings`, { host });
  check('anon GET meetings → 401', meetR.status === 401, String(meetR.status));

  const penR = await req('GET', `/api/events/${eventId}/penatalayan`, { host });
  check('anon GET penatalayan → 401', penR.status === 401, String(penR.status));

  if (meetingId) {
    const icsR = await req('GET', `/api/events/meetings/${meetingId}/ics`, { host });
    check('anon GET ICS → 401', icsR.status === 401, String(icsR.status));
  } else {
    skipped('ICS', 'event tanpa rapat');
  }
}

function isProductionHost(host) {
  return /\.gehc\.page$/.test(host) && !host.startsWith('staging-') && host !== 'staging.gehc.page';
}

async function registrationSuite(hostYouth, hostMen) {
  console.log('\n— Registrasi tenant —');
  if (isProductionHost(hostMen)) {
    skipped('register/local unit tertutup', 'host produksi — jangan buat akun uji (pakai staging)');
  } else {
    const closedR = await req('POST', '/api/register/local', {
      host: hostMen,
      body: {
        name: 'QA Security Closed',
        email: `qa-sec-closed-${Date.now()}@example.com`,
        password: 'password123',
      },
    });
    check('register/local di unit tertutup (men) → 403', closedR.status === 403, String(closedR.status));
  }

  const existingR = await req('POST', '/api/join/local', {
    host: hostYouth,
    body: {
      name: 'Existing User',
      email: MENTEE_EMAIL,
      password: 'password123',
      code: 'GEHC-INVALID',
    },
  });
  check('join/local akun existing → 409/400 (bukan 403 registrasi)', existingR.status === 409 || existingR.status === 400, String(existingR.status));
}

async function main() {
  console.log(`> QA keamanan direktori\n  BASE=${BASE}\n  hosts=${QA_HOSTS.join(', ')}`);
  if (!BASIC && (BASE.includes('staging') || BASE.includes('-gehc.vercel.app'))) {
    console.warn('\n⚠ STAGING_BASIC_AUTH kosong — API staging/preview biasanya 401.');
  }

  const ver = await req('GET', '/api/version');
  if (ver.status === 200 && ver.data?.commit) {
    console.log(`  commit=${ver.data.commit}`);
    if (EXPECT_COMMIT) {
      check(`commit mengandung ${EXPECT_COMMIT}`, String(ver.data.commit).startsWith(EXPECT_COMMIT));
    }
  } else {
    check('GET /api/version', false, String(ver.status));
    if (ver.status === 401) {
      console.error('\nGagal: butuh STAGING_BASIC_AUTH (lihat docs/tech/staging-parity.md).');
      process.exit(2);
    }
  }

  let allGroups = [];
  for (const host of QA_HOSTS) {
    const label = host.replace('.gehc.page', '');
    const groups = await anonPublicSuite(label, host);
    if (host.includes('youth') && groups) allGroups = groups;
  }

  await pastoralSuite(QA_HOSTS.find((h) => h.includes('youth')) || QA_HOSTS[0], allGroups);
  await eventAuthSuite(QA_HOSTS[0]);
  const onStaging = BASE.includes('staging') || BASE.includes('-gehc.vercel.app');
  const hostYouth = process.env.QA_YOUTH_HOST
    || QA_HOSTS.find((h) => h.includes('youth'))
    || (onStaging ? 'staging-youth.gehc.page' : 'youth.gehc.page');
  const hostMen = process.env.QA_MEN_HOST
    || QA_HOSTS.find((h) => h.includes('men'))
    || (onStaging ? 'staging-men.gehc.page' : 'men.gehc.page');
  await registrationSuite(hostYouth, hostMen);

  console.log(`\nRingkas: ${pass} lulus, ${fail} gagal, ${skip} skip`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
