/**
 * QA kerangka segmen pola + firman auto (via API lokal).
 *
 * Alur: login demo → bulk kerangka (slot kosong + firman) → jejak segmen
 * tersimpan → isi slot lagu → firman manual menang → live + baca →
 * BERSIHKAN semua.
 *
 * Jalankan (server lokal dulu: `node server/index.mjs`):
 *   node scripts/qa-liturgy-segments.mjs --base http://localhost:8787
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

  // Lagu QA untuk slot.
  const song = await admin.post('/api/songs', {
    title: 'QA Segmen (hapus)', source: 'LOKAL', authors: 'QA', defaultKey: 'G',
    lyricsChordPro: '[Verse 1]\n[G]La la la',
  });
  ok(`buat lagu QA (${song.status})`, song.status === 201);
  const ss = await admin.post(`/api/events/${eventId}/songs`, { songId: song.data.song.id, moment: 'pembuka' });
  ok(`masuk setlist (${ss.status})`, ss.status === 201);

  // 1. Bulk kerangka.
  const bulk = await admin.post(`/api/events/${eventId}/order/bulk`, { items: [
    { kind: 'lagu', title: 'Praise 1', segmentKey: '1:praise', phaseNo: 1 },
    { kind: 'lagu', title: 'Worship 1', segmentKey: '1:worship', phaseNo: 1 },
    { kind: 'firman', title: 'Firman', segmentKey: '2:firman', phaseNo: 2 },
  ] });
  ok(`bulk kerangka (${bulk.status}, count=${bulk.data.count})`, bulk.status === 201 && bulk.data.count === 3);
  const [p1, w1, f1] = bulk.data.items.slice(-3);
  ok('jejak segmen tersimpan', p1.segmentKey === '1:praise' && f1.segmentKey === '2:firman' && f1.phaseNo === 2);
  ok('slot lagu kosong', p1.serviceSongId === null || p1.serviceSongId === undefined);

  // 2. Bulk kosong/invalid ditolak.
  const badEmpty = await admin.post(`/api/events/${eventId}/order/bulk`, { items: [] });
  ok(`bulk kosong 400 (dapat ${badEmpty.status})`, badEmpty.status === 400);
  const badKind = await admin.post(`/api/events/${eventId}/order/bulk`, { items: [{ kind: 'solo' }] });
  ok(`bulk kind aneh 400 (dapat ${badKind.status})`, badKind.status === 400);

  // 3. Isi slot + firman manual menang.
  const fill = await admin.put(`/api/events/${eventId}/order/${p1.id}`, { serviceSongId: ss.data.item.id });
  ok(`isi slot (${fill.status})`, fill.status === 200);
  const man = await admin.put(`/api/events/${eventId}/order/${f1.id}`, { body: 'Yohanes 3:16 — kasih Allah.' });
  ok(`firman manual (${man.status})`, man.status === 200);

  // 4. Live: tulis + baca (login).
  const live = await admin.put(`/api/events/${eventId}/liturgy-live`, { status: 'LIVE', currentItemId: p1.id, sectionIndex: 0 });
  ok(`live LIVE + kode (${live.status})`, live.status === 200 && !!live.data.state?.accessCode);
  const got = await admin.get(`/api/events/${eventId}/liturgy-live`);
  const cur = (got.data.items || []).find((i) => i.id === p1.id);
  ok('layar lagu ter-resolve', cur?.display?.kind === 'song' && cur.display.hasLyrics === true);
  const ftxt = (got.data.items || []).find((i) => i.id === f1.id);
  ok('layar firman manual (bukan auto)', ftxt?.display?.kind === 'text' && ftxt.display.auto === false
    && String(ftxt.display.body || '').includes('Yohanes 3:16'));

  // 5. Bersih-bersih.
  await admin.put(`/api/events/${eventId}/liturgy-live`, { status: 'DRAFT', currentItemId: null });
  for (const it of [p1, w1, f1]) await admin.delete(`/api/events/${eventId}/order/${it.id}`);
  await admin.delete(`/api/events/${eventId}/songs/${ss.data.item.id}`);
  const del = await admin.delete(`/api/songs/${song.data.song.id}`);
  ok(`bersih total (${del.status})`, del.status === 200);
  const left = await admin.get(`/api/events/${eventId}/order`);
  ok('order QA bersih', !(left.data.items || []).some((i) => [p1.id, w1.id, f1.id].includes(i.id)));

  console.log(`\n✓ QA SEGMEN LULUS (${pass} cek).`);
})().catch((e) => {
  console.error(`\n✗ QA GAGAL: ${e.message}`);
  process.exit(1);
});
