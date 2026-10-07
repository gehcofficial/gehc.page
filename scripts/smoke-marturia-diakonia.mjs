/**
 * Smoke E2E Sprint A Marturia & Diakonia vs staging (atau BASE_URL lain).
 *
 *   BASE_URL=https://staging-youth.gehc.page \
 *   STAGING_BASIC_AUTH='user:pass' \
 *   DEMO_PASSWORD=password123 \
 *   node scripts/smoke-marturia-diakonia.mjs [--keep]
 *
 * Tanpa --keep: semua data uji dihapus kembali (assert 0 sisa).
 * Keluar non-zero bila ada assert gagal.
 */
const BASE = (process.env.BASE_URL || 'https://staging-youth.gehc.page').replace(/\/$/, '');
const BASIC = process.env.STAGING_BASIC_AUTH || '';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';
const KEEP = process.argv.includes('--keep');

const basicHeaders = BASIC
  ? { Authorization: 'Basic ' + Buffer.from(BASIC).toString('base64') }
  : {};

let pass = 0;
let fail = 0;
const created = { shots: [], assets: [], souls: [], cases: [], transport: [], kost: [], refs: [] };

function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function req(method, path, { session = null, body = undefined } = {}) {
  const headers = { ...basicHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers.Cookie = session;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch { /* non-JSON */ }
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, data, setCookie };
}

async function login(email, password = DEMO_PASSWORD) {
  const r = await req('POST', '/api/auth/local', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status}`);
  const m = /gehc_session=[^;]+/.exec(r.setCookie);
  if (!m) throw new Error(`login ${email}: cookie sesi tidak ada`);
  return m[0];
}

const email = (slug) => `${slug}@gehc.demo`;

async function main() {
  console.log(`> smoke Marturia & Diakonia vs ${BASE}`);

  // 0. Tanpa sesi → 401 (route terdaftar & terkunci).
  const unauth = await req('GET', '/api/events/x/marturia/shotlist');
  check('tanpa login → 401', unauth.status === 401, `dapat ${unauth.status}`);

  // 1. Login dua peran divisi.
  const sesMarturia = await login(email('gievara.bogar'));
  check('login Marturia (gievara) → 200', true);
  const sesDiakonia = await login(email('prichel.kampong'));
  check('login Diakonia (prichel) → 200', true);

  // 2. Pilih event ACTIVE pertama.
  const ev = await req('GET', '/api/events', { session: sesMarturia });
  const events = ev.data?.events || [];
  const target = events.find((e) => String(e.status).toUpperCase() === 'ACTIVE') || events[0];
  check('event staging tersedia', Boolean(target), JSON.stringify(events.length));
  const eid = target.id;
  console.log(`  event: ${target.name} (${eid})`);

  // 3. Shotlist: seed → list → toggle (hanya id BARU yang dilacak untuk cleanup).
  const preList = await req('GET', `/api/events/${eid}/marturia/shotlist`, { session: sesMarturia });
  const preIds = new Set((preList.data?.items || []).map((s) => s.id));
  const seed = await req('POST', `/api/events/${eid}/marturia/shotlist/seed`, { session: sesMarturia });
  check('seed shotlist → 200', seed.status === 200, `dapat ${seed.status} seeded=${seed.data?.seeded} kept=${seed.data?.kept}`);
  const list1 = await req('GET', `/api/events/${eid}/marturia/shotlist`, { session: sesMarturia });
  const shots = list1.data?.items || [];
  check('shotlist ≥6 item', shots.length >= 6, `dapat ${shots.length}`);
  for (const s of shots) {
    if (!preIds.has(s.id)) created.shots.push(s.id);
  }
  const first = shots[0];
  const tog = await req('PATCH', `/api/marturia/shotlist/${first.id}`, { session: sesMarturia, body: { done: true } });
  check('toggle done → true', tog.status === 200 && tog.data?.item?.done === true, `dapat ${tog.status}`);
  await req('PATCH', `/api/marturia/shotlist/${first.id}`, { session: sesMarturia, body: { done: false } });

  // 4. Guard peran: akun segar tanpa peran/divisi tidak boleh tulis apa pun.
  // (BOD Tim Kerja tanpa divisi memang melihat semua panel — division-access.mjs —
  //  jadi akun COMMITTEE seperti gievara/prichel BUKAN bukti guard.)
  const narrowEmail = `uji-otomatis-${Date.now().toString(36)}@gehc.demo`;
  const reg = await req('POST', '/api/register/local', { body: { name: 'Uji Otomatis', email: narrowEmail, password: 'UjiOtomatis123' } });
  if (reg.status !== 200 && reg.status !== 201) {
    console.log(`  ! registrasi uji dilewati (status ${reg.status}) — guard sempit tidak teruji`);
  } else {
    const sesNarrow = await login(narrowEmail, 'UjiOtomatis123');
    const cross = await req('POST', `/api/events/${eid}/diakonia/checks`, { session: sesNarrow, body: { area: 'LOGISTIK', status: 'SIAP' } });
    check('akun segar tulis Diakonia → 403', cross.status === 403, `dapat ${cross.status}`);
    const cross2 = await req('POST', `/api/events/${eid}/marturia/shotlist`, { session: sesNarrow, body: { item: 'UJI-OTOMATIS-x' } });
    check('akun segar tulis Marturia → 403', cross2.status === 403, `dapat ${cross2.status}`);
    const cross3 = await req('GET', '/api/diakonia/cases', { session: sesNarrow });
    check('akun segar baca kasus → 200 termasking', cross3.status === 200 && cross3.data?.canSeeSubject === false, `dapat ${cross3.status}`);
    // Hapus akun uji via Komisi (purge relasi + row).
    try {
      const sesKomisi = await login(email('stevania.hadinda'));
      const me = await req('GET', '/api/auth/me', { session: sesNarrow });
      const uid = me.data?.user?.id;
      if (uid) {
        const del = await req('DELETE', `/api/people/${uid}`, { session: sesKomisi, body: { confirm: narrowEmail, confirmPhrase: 'HAPUS' } });
        check('bersih: akun uji terhapus', del.status === 200, `dapat ${del.status}`);
      }
    } catch (e) {
      console.log(`  ! bersih akun uji gagal: ${e?.message || e}`);
      fail += 1;
    }
  }

  // 5. Readiness + transport (Diakonia).
  const chk = await req('POST', `/api/events/${eid}/diakonia/checks`, { session: sesDiakonia, body: { area: 'LOGISTIK', status: 'SIAP', note: 'uji otomatis' } });
  check('upsert check LOGISTIK → 200', chk.status === 200, `dapat ${chk.status}`);
  const ready = await req('GET', `/api/events/${eid}/diakonia/readiness`, { session: sesDiakonia });
  check('readiness overall valid', ['BELUM', 'SIAP', 'KENDALA'].includes(ready.data?.summary?.overall), JSON.stringify(ready.data?.summary));
  const tr = await req('POST', `/api/events/${eid}/diakonia/transport`, { session: sesDiakonia, body: { pickupPoint: 'UJI-OTOMATIS Gerbang X', driver: 'UJI' } });
  check('tambah transport → 200', tr.status === 200, `dapat ${tr.status}`);
  if (tr.data?.item?.id) created.transport.push(tr.data.item.id);

  // 6. Kasus mercy: lapor → assess → visit → lompat ilegal 409.
  const cs = await req('POST', '/api/diakonia/cases', { session: sesDiakonia, body: { title: 'UJI-OTOMATIS kunjung', kind: 'SAKIT' } });
  check('buat kasus → 200', cs.status === 200, `dapat ${cs.status}`);
  const cid = cs.data?.item?.id;
  if (cid) created.cases.push(cid);
  const adv = await req('PATCH', `/api/diakonia/cases/${cid}`, { session: sesDiakonia, body: { status: 'ASSESS' } });
  check('LAPOR → ASSESS → 200', adv.status === 200, `dapat ${adv.status}`);
  const jump = await req('PATCH', `/api/diakonia/cases/${cid}`, { session: sesDiakonia, body: { status: 'TUTUP' } });
  check('ASSESS → TUTUP ditolak 409', jump.status === 409, `dapat ${jump.status}`);
  const vis = await req('POST', `/api/diakonia/cases/${cid}/visits`, { session: sesDiakonia, body: { visitedOn: new Date().toISOString().slice(0, 10), result: 'uji otomatis' } });
  check('catat kunjungan → 200', vis.status === 200, `dapat ${vis.status}`);

  // 7. Aset desain: buat → lompat ilegal 409 → maju benar → versi.
  const as = await req('POST', `/api/events/${eid}/marturia/assets`, { session: sesMarturia, body: { title: 'UJI-OTOMATIS poster', brief: 'uji' } });
  check('request asset → 200', as.status === 200, `dapat ${as.status}`);
  const aid = as.data?.item?.id;
  if (aid) created.assets.push(aid);
  const askip = await req('PATCH', `/api/marturia/assets/${aid}`, { session: sesMarturia, body: { status: 'REVIEW' } });
  check('DIMINTA → REVIEW ditolak 409', askip.status === 409, `dapat ${askip.status}`);
  const aok = await req('PATCH', `/api/marturia/assets/${aid}`, { session: sesMarturia, body: { status: 'DIGARAP' } });
  check('DIMINTA → DIGARAP → 200', aok.status === 200, `dapat ${aok.status}`);
  const ver = await req('POST', `/api/marturia/assets/${aid}/versions`, { session: sesMarturia, body: { url: 'https://drive.google.com/uji' } });
  check('tambah versi → 200', ver.status === 200, `dapat ${ver.status}`);

  // 8. Jiwa baru + referral publik.
  const so = await req('POST', `/api/events/${eid}/marturia/souls`, { session: sesMarturia, body: { nickname: 'UJI-OTOMATIS' } });
  check('catat jiwa → 200', so.status === 200, `dapat ${so.status}`);
  const sid = so.data?.item?.id;
  if (sid) created.souls.push(sid);
  const soUp = await req('PATCH', `/api/marturia/souls/${sid}`, { session: sesMarturia, body: { status: 'HADIR' } });
  check('jiwa → HADIR → 200', soUp.status === 200, `dapat ${soUp.status}`);
  const rf = await req('POST', '/api/marturia/referrals', { session: sesMarturia });
  check('buat referral → 200', rf.status === 200, `dapat ${rf.status}`);
  const code = rf.data?.item?.code;
  const pub = await req('GET', `/api/r/${code}`);
  check('link publik /r/:code → 200 + klik', pub.status === 200 && typeof pub.data?.registerUrl === 'string', `dapat ${pub.status}`);

  // 9. Kost: usul → tampil.
  const ko = await req('POST', '/api/diakonia/kost', { session: sesDiakonia, body: { area: 'UJI-OTOMATIS Blok Z', priceRange: '500rb' } });
  check('usul kos → 200', ko.status === 200, `dapat ${ko.status}`);
  const kid = ko.data?.item?.id;
  if (kid) created.kost.push(kid);
  const koUp = await req('PATCH', `/api/diakonia/kost/${kid}`, { session: sesDiakonia, body: { status: 'TAMPIL' } });
  check('moderasi TAMPIL → 200', koUp.status === 200, `dapat ${koUp.status}`);

  // 10. Bersih-bersih (atau --keep).
  if (!KEEP) {
    // Sweep residu uji (item 'x' run lama + marker UJI-OTOMATIS) — jangan sentuh milik orang.
    const sweep = await req('GET', `/api/events/${eid}/marturia/shotlist`, { session: sesMarturia });
    for (const s of sweep.data?.items || []) {
      if (s.item === 'x' || String(s.item).includes('UJI-OTOMATIS')) {
        // eslint-disable-next-line no-await-in-loop
        await req('DELETE', `/api/marturia/shotlist/${s.id}`, { session: sesMarturia });
      }
    }
    for (const id of created.shots) await req('DELETE', `/api/marturia/shotlist/${id}`, { session: sesMarturia });
    for (const id of created.assets) await req('DELETE', `/api/marturia/assets/${id}`, { session: sesMarturia });
    for (const id of created.souls) await req('DELETE', `/api/marturia/souls/${id}`, { session: sesMarturia });
    for (const id of created.cases) await req('DELETE', `/api/diakonia/cases/${id}`, { session: sesDiakonia });
    for (const id of created.transport) await req('DELETE', `/api/diakonia/transport/${id}`, { session: sesDiakonia });
    for (const id of created.kost) await req('DELETE', `/api/diakonia/kost/${id}`, { session: sesDiakonia });
    await req('POST', `/api/events/${eid}/diakonia/checks`, { session: sesDiakonia, body: { area: 'LOGISTIK', status: 'BELUM', note: '' } });
    const soulsAfter = await req('GET', `/api/events/${eid}/marturia/souls`, { session: sesMarturia });
    const leftSouls = (soulsAfter.data?.items || []).filter((s) => s.nickname === 'UJI-OTOMATIS');
    check('bersih: 0 jiwa uji tersisa', leftSouls.length === 0, `sisa ${leftSouls.length}`);
    const kostAfter = await req('GET', '/api/diakonia/kost', { session: sesDiakonia });
    const leftKost = (kostAfter.data?.items || []).filter((k) => String(k.area).includes('UJI-OTOMATIS'));
    check('bersih: 0 kos uji tersisa', leftKost.length === 0, `sisa ${leftKost.length}`);
  }

  console.log(`\nAPI smoke: ${pass} lolos, ${fail} gagal.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e);
  process.exit(1);
});
