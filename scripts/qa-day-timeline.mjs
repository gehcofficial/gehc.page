/**
 * QA timeline hari Koinonia (via API lokal).
 *
 * Alur: login admin → CRUD blok (ibadah + pengumuman + selebrasi) →
 * validasi (tanggal/kind/event) → reorder → ringkasan ibadah →
 * BERSIHKAN semua.
 *
 * Jalankan (server lokal dulu: `node server/index.mjs`):
 *   node scripts/qa-day-timeline.mjs --base http://localhost:8787
 *
 * Demi aman: HANYA localhost. Tidak ada --force.
 */
import 'dotenv/config';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const BASE = String(flag('base', 'http://localhost:8787')).replace(/\/+$/, '');
const ADMIN = String(flag('admin', 'tech@gehc.demo'));
const PASSWORD = String(flag('password', 'password123'));
const DAY = '2099-01-04';

const host = new URL(BASE).hostname;
if (host !== 'localhost' && host !== '127.0.0.1') {
  throw new Error(`QA ini hanya untuk localhost (dapat ${host}).`);
}

let pass = 0;
const ok = (label, cond) => {
  pass += cond ? 1 : 0;
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) throw new Error(`GAGAL: ${label}`);
};

class Client {
  constructor() { this.cookies = new Map(); }
  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookies.size) headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const pair = c.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  get(p) { return this.request('GET', p); }
  post(p, b) { return this.request('POST', p, b); }
  put(p, b) { return this.request('PUT', p, b); }
  delete(p) { return this.request('DELETE', p); }
}

(async () => {
  const admin = new Client();
  const r0 = await admin.post('/api/auth/local', { login: ADMIN, password: PASSWORD });
  ok(`login admin (${r0.status})`, r0.status === 200);

  const ev = await admin.get('/api/events');
  const eventId = ev.data?.events?.[0]?.id || ev.data?.[0]?.id;
  ok('event ditemukan', !!eventId);

  // Validasi.
  const badDay = await admin.post('/api/day-timeline', { kind: 'pengumuman', day: 'asal' });
  ok(`tanggal wajib (400, dapat ${badDay.status})`, badDay.status === 400);
  const badKind = await admin.post('/api/day-timeline', { kind: 'karnaval', day: DAY });
  ok(`kind valid (400, dapat ${badKind.status})`, badKind.status === 400);
  const badEv = await admin.post('/api/day-timeline', { kind: 'ibadah-block', day: DAY });
  ok(`ibadah wajib event (400, dapat ${badEv.status})`, badEv.status === 400);
  const badEv2 = await admin.post('/api/day-timeline', { kind: 'ibadah-block', day: DAY, eventId: 'evt-tidak-ada' });
  ok(`event harus ada (400, dapat ${badEv2.status})`, badEv2.status === 400);

  // CRUD: ibadah + pengumuman + selebrasi.
  const b1 = await admin.post('/api/day-timeline', { kind: 'ibadah-block', day: DAY, eventId, title: 'Ibadah QA' });
  ok(`blok ibadah (${b1.status})`, b1.status === 201);
  const b2 = await admin.post('/api/day-timeline', {
    kind: 'pengumuman', day: DAY, title: 'Pengumuman QA', body: 'Retreat bulan depan.', owner: 'MC', minutes: 5,
  });
  ok(`blok pengumuman (${b2.status})`, b2.status === 201);
  const b3 = await admin.post('/api/day-timeline', {
    kind: 'selebrasi', day: DAY, title: 'HUT QA', body: 'Tiup lilin.', owner: 'Koinonia', minutes: 10,
  });
  ok(`blok selebrasi (${b3.status})`, b3.status === 201);

  const list = await admin.get(`/api/day-timeline?day=${DAY}`);
  ok(`list 3 blok (${list.data.items?.length})`, list.data.items?.length === 3);
  const ibadah = list.data.items.find((i) => i.kind === 'ibadah-block');
  ok('ringkasan ibadah menempel', !!ibadah?.event?.id && typeof ibadah.event.orderCount === 'number');

  // Reorder: selebrasi ke depan.
  const ro = await admin.post('/api/day-timeline/reorder', {
    day: DAY, orderedIds: [b3.data.item.id, b1.data.item.id, b2.data.item.id],
  });
  ok(`reorder (${ro.status}, depan=${ro.data.items?.[0]?.kind})`,
    ro.status === 200 && ro.data.items[0].kind === 'selebrasi');

  // PUT edit + 404.
  const upd = await admin.put(`/api/day-timeline/${b2.data.item.id}`, { minutes: 7 });
  ok(`edit menit (${upd.status}, ${upd.data.item?.minutes})`, upd.status === 200 && upd.data.item.minutes === 7);
  const nf = await admin.put('/api/day-timeline/dtl-tidak-ada', { title: 'x' });
  ok(`PUT asing 404 (dapat ${nf.status})`, nf.status === 404);

  // Bersih-bersih.
  for (const b of [b1, b2, b3]) await admin.delete(`/api/day-timeline/${b.data.item.id}`);
  const left = await admin.get(`/api/day-timeline?day=${DAY}`);
  ok('timeline QA bersih', (left.data.items || []).length === 0);

  console.log(`\n✓ QA TIMELINE LULUS (${pass} cek).`);
})().catch((e) => {
  console.error(`\n✗ QA GAGAL: ${e.message}`);
  process.exit(1);
});
