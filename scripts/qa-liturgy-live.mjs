/**
 * QA Tata Ibadah Live + Transpose Pemusik (ujung-ke-ujung via API lokal).
 *
 * Alur: login admin demo → buat lagu LOKAL ber-chord → setlist → order
 * (lagu + firman) → reorder → live LIVE → baca via kode (tanpa login) →
 * mysetting 2 akun → ekspor asMe → negatif (400/401) → BERSIHKAN semua.
 *
 * Jalankan (server lokal dulu: `node server/index.mjs`):
 *   node scripts/qa-liturgy-live.mjs --base http://localhost:8787
 *
 * Demi aman: HANYA localhost. Tidak ada --force.
 */
import mysql from 'mysql2/promise';
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
  async request(method, path, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.cookies.size) {
      headers.Cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const pair = c.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
  get(p, auth = true) { return this.request('GET', p, undefined, auth); }
  post(p, b) { return this.request('POST', p, b); }
  put(p, b) { return this.request('PUT', p, b); }
  delete(p) { return this.request('DELETE', p); }
}

function dbConn() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing (.env)');
  const u = new URL(raw);
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
}

const CHORD = ['[Verse 1]', '[G]Kasih setia-Mu [C]tak pernah berakhir,', '', '[Chorus]', '[G]Besar setia-Mu.'].join('\n');

(async () => {
  const admin = new Client();
  const r0 = await admin.post('/api/auth/local', { login: ADMIN, password: PASSWORD });
  ok(`login admin ${ADMIN} (${r0.status})`, r0.status === 200);

  // Akun kedua untuk mysetting berbeda (peran apa pun, cukup login).
  const conn = await dbConn();
  const [users] = await conn.query(
    `SELECT email FROM users WHERE email LIKE '%@gehc.demo' AND password_hash IS NOT NULL AND email <> ? LIMIT 5`,
    [ADMIN],
  );
  await conn.end();
  const secondEmail = users[0]?.email || ADMIN;
  const second = new Client();
  if (secondEmail !== ADMIN) {
    const r2 = await second.post('/api/auth/local', { login: secondEmail, password: PASSWORD });
    ok(`login kedua ${secondEmail} (${r2.status})`, r2.status === 200);
  }

  // Event pertama yang ada.
  const ev = await admin.get('/api/events');
  const eventId = ev.data?.events?.[0]?.id || ev.data?.[0]?.id;
  ok(`event ditemukan (${eventId || 'TIDAK ADA'})`, !!eventId);

  // 1. Lagu LOKAL ber-chord (dibuat khusus QA).
  const song = await admin.post('/api/songs', {
    title: 'QA Liturgia Live (hapus)', source: 'LOKAL', authors: 'QA',
    defaultKey: 'G', lyricsChordPro: CHORD,
  });
  ok(`buat lagu QA (${song.status})`, song.status === 201);
  const songId = song.data.song.id;

  // 2. Setlist + order (lagu + firman).
  const ss = await admin.post(`/api/events/${eventId}/songs`, { songId, moment: 'pembuka' });
  ok(`masuk setlist (${ss.status})`, ss.status === 201);
  const ssId = ss.data.item.id;

  const o1 = await admin.post(`/api/events/${eventId}/order`, { kind: 'lagu', serviceSongId: ssId });
  ok(`order momen lagu (${o1.status})`, o1.status === 201);
  const o2 = await admin.post(`/api/events/${eventId}/order`, {
    kind: 'firman', title: 'Bacaan QA', body: 'Yohanes 3:16', owner: 'QA', minutes: 5,
  });
  ok(`order momen firman (${o2.status})`, o2.status === 201);

  // Negatif: lagu tanpa serviceSongId, kind aneh.
  const bad1 = await admin.post(`/api/events/${eventId}/order`, { kind: 'lagu' });
  ok(`tolak lagu tanpa setlist (400, dapat ${bad1.status})`, bad1.status === 400);
  const bad2 = await admin.post(`/api/events/${eventId}/order`, { kind: 'solo' });
  ok(`tolak kind aneh (400, dapat ${bad2.status})`, bad2.status === 400);

  // 3. List + reorder.
  const list = await admin.get(`/api/events/${eventId}/order`);
  ok(`order terisi 2 (${list.data.items?.length})`, list.data.items?.length === 2);
  const ro = await admin.post(`/api/events/${eventId}/order/reorder`, { orderedIds: [o2.data.item.id, o1.data.item.id] });
  ok(`reorder (${ro.status}, pertama=${ro.data.items?.[0]?.kind})`, ro.status === 200 && ro.data.items[0].kind === 'firman');
  await admin.post(`/api/events/${eventId}/order/reorder`, { orderedIds: [o1.data.item.id, o2.data.item.id] });

  // 4. Live: tulis + baca via kode tanpa login.
  const live = await admin.put(`/api/events/${eventId}/liturgy-live`, {
    status: 'LIVE', currentItemId: o1.data.item.id, sectionIndex: 1,
  });
  ok(`live LIVE + kode (${live.status})`, live.status === 200 && !!live.data.state?.accessCode);
  const code = live.data.state.accessCode;

  const anon = new Client();
  const noAuth = await anon.get(`/api/events/${eventId}/liturgy-live`, false);
  ok(`tanpa kode ditolak 401 (dapat ${noAuth.status})`, noAuth.status === 401);
  const pub = await anon.get(`/api/events/${eventId}/liturgy-live?code=${code}`, false);
  ok(`baca via kode (${pub.status})`, pub.status === 200);
  const cur = pub.data.items.find((i) => i.id === o1.data.item.id);
  ok('display lagu ter-resolve', cur?.display?.kind === 'song' && cur.display.hasLyrics === true);
  ok(`bait bersih tanpa chord ("${cur.display.sections?.[1]?.lines?.[0] || ''}")`,
    cur.display.sections?.[1]?.lines?.[0] === 'Besar setia-Mu.');
  const txt = pub.data.items.find((i) => i.id === o2.data.item.id);
  ok('display firman teks', txt?.display?.kind === 'text' && txt.display.body === 'Yohanes 3:16');

  // Negatif: currentItemId asing.
  const bad3 = await admin.put(`/api/events/${eventId}/liturgy-live`, { currentItemId: 'sord-tidak-ada' });
  ok(`tolak momen asing (400, dapat ${bad3.status})`, bad3.status === 400);

  // 5. Transpose personal 2 akun + ekspor asMe.
  const m1 = await admin.put(`/api/events/${eventId}/songs/${ssId}/mysetting`, { transpose: 2, capo: 1 });
  ok(`mysetting admin +2 (${m1.status}, eff=${m1.data.effective?.transpose})`,
    m1.status === 200 && m1.data.effective?.transpose === 2 && m1.data.effective?.capo === 1);
  const m2 = await second.put(`/api/events/${eventId}/songs/${ssId}/mysetting`, { transpose: -1, capo: null });
  ok(`mysetting kedua -1 (${m2.status}, eff=${m2.data.effective?.transpose})`,
    m2.status === 200 && m2.data.effective?.transpose === -1);

  const expRes = await fetch(
    `${BASE}/api/events/${eventId}/songs/export?download=chordpro&itemId=${ssId}&asMe=1`,
    { headers: { Cookie: [...admin.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ') } },
  );
  const expText = await expRes.text();
  ok(`ekspor asMe admin memuat [A] (G+2)`, expRes.status === 200 && expText.includes('[A]'));

  // 6. Bersih-bersih: live DONE → hapus order, setlist, lagu, setting, state.
  await admin.put(`/api/events/${eventId}/liturgy-live`, { status: 'DONE', currentItemId: null });
  await admin.delete(`/api/events/${eventId}/order/${o1.data.item.id}`);
  await admin.delete(`/api/events/${eventId}/order/${o2.data.item.id}`);
  await admin.delete(`/api/events/${eventId}/songs/${ssId}`);
  const delSong = await admin.delete(`/api/songs/${songId}`);
  ok(`lagu QA terhapus (${JSON.stringify(delSong.data).slice(0, 60)})`, delSong.status === 200);
  const c2 = await dbConn();
  await c2.query(`DELETE FROM service_song_settings WHERE service_song_id = ?`, [ssId]);
  await c2.query(`DELETE FROM service_live_state WHERE event_id = ? AND access_code = ?`, [eventId, code]);
  const [left] = await c2.query(
    `SELECT (SELECT COUNT(*) FROM service_order_items WHERE event_id = ?) AS o,
            (SELECT COUNT(*) FROM service_songs WHERE event_id = ? AND id = ?) AS s`,
    [eventId, eventId, ssId],
  );
  await c2.end();
  ok(`sisa QA bersih (order=${left[0].o} setlist=${left[0].s})`, left[0].o === 0 && left[0].s === 0);

  console.log(`\n✓ QA LITURGIA LIVE LULUS (${pass} cek).`);
})().catch((e) => {
  console.error(`\n✗ QA GAGAL: ${e.message}`);
  process.exit(1);
});
