/**
 * QA susunan default master (ujung-ke-ujung via API lokal).
 *
 * Alur: login demo → buat lagu LOKAL + susunan master [Chorus, Verse 1] →
 * tolak susunan basi (400) → setlist → ekspor ikut susunan master →
 * BERSIHKAN semua.
 *
 * Jalankan (server lokal dulu: `node server/index.mjs`):
 *   node scripts/qa-song-master.mjs --base http://localhost:8787
 *
 * Demi aman: HANYA localhost. Tidak ada --force.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

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
  cookie() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookies.size) headers.Cookie = this.cookie();
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

/** Hapus sisa QA terdahulu (judul berawalan 'QA ') langsung via DB. */
async function preclean() {
  const conn = await dbConn();
  const [songs] = await conn.query(`SELECT id, title FROM songs WHERE title LIKE 'QA %'`);
  for (const s of songs) {
    const [rows] = await conn.query('SELECT id FROM service_songs WHERE song_id = ?', [s.id]);
    for (const r of rows) {
      await conn.query('DELETE FROM service_song_settings WHERE service_song_id = ?', [r.id]);
      await conn.query('DELETE FROM service_order_items WHERE service_song_id = ?', [r.id]);
      await conn.query('DELETE FROM service_songs WHERE id = ?', [r.id]);
    }
    await conn.query('DELETE FROM songs WHERE id = ?', [s.id]);
    console.log(`  (bersihkan sisa: ${s.title})`);
  }
  await conn.end();
}

const CHORD = ['[Verse 1]', '[G]Kasih setia-Mu', '', '[Chorus]', '[C]Besar setia-Mu'].join('\n');

(async () => {
  await preclean();
  const admin = new Client();
  const r0 = await admin.post('/api/auth/local', { login: ADMIN, password: PASSWORD });
  ok(`login admin (${r0.status})`, r0.status === 200);

  const ev = await admin.get('/api/events');
  const eventId = ev.data?.events?.[0]?.id || ev.data?.[0]?.id;
  ok(`event ditemukan`, !!eventId);

  // 1. Lagu + susunan master [Chorus, Verse 1].
  const song = await admin.post('/api/songs', {
    title: 'QA Master Susunan (hapus)', source: 'LOKAL', authors: 'QA',
    defaultKey: 'G', lyricsChordPro: CHORD,
    arrangement: [{ section: 'Chorus' }, { section: 'Verse 1' }],
  });
  ok(`buat lagu + susunan (${song.status})`, song.status === 201);
  ok('susunan ternormalisasi',
    JSON.stringify(song.data.song.arrangement) === JSON.stringify([
      { section: 'Chorus', key: null, transpose: null },
      { section: 'Verse 1', key: null, transpose: null },
    ]));
  const songId = song.data.song.id;

  // 2. Tolak susunan basi.
  const bad = await admin.post('/api/songs', {
    title: 'QA Basi (jangan ada)', source: 'LOKAL', authors: 'QA',
    defaultKey: 'G', lyricsChordPro: CHORD, arrangement: ['Bridge'],
  });
  ok(`tolak bagian tak dikenal (400, dapat ${bad.status})`, bad.status === 400);

  // 3. Setlist tanpa sections → ekspor ikut susunan master.
  const ss = await admin.post(`/api/events/${eventId}/songs`, { songId, moment: 'bebas' });
  ok(`masuk setlist (${ss.status})`, ss.status === 201);
  const exp = await admin.get(`/api/events/${eventId}/songs/export`);
  const mine = (exp.data.items || []).find((i) => i.songId === songId);
  ok('ekspor ikut susunan master (Chorus dulu)',
    !!mine && mine.quickLyrics.indexOf('Besar setia-Mu') < mine.quickLyrics.indexOf('Kasih setia-Mu'));

  // 4. Pemakaian per event tetap menang atas master.
  await admin.put(`/api/events/${eventId}/songs/${ss.data.item.id}`, { sections: ['Verse 1'] });
  const exp2 = await admin.get(`/api/events/${eventId}/songs/export`);
  const mine2 = (exp2.data.items || []).find((i) => i.songId === songId);
  ok('override pemakaian menang',
    !!mine2 && !mine2.quickLyrics.includes('Besar setia-Mu') && mine2.quickLyrics.includes('Kasih setia-Mu'));

  // 5. Varian bernama: pool + full/v1only; default (full) dipakai saat pemakaian dikosongkan.
  const CHORD2 = ['[Verse 1]', '[G]Satu', '', '[Verse 2]', '[G]Dua', '', '[Chorus]', '[C]Reff'].join('\n');
  const putV = await admin.put(`/api/songs/${songId}`, {
    lyricsChordPro: CHORD2,
    arrangements: {
      master: ['Verse 1', 'Verse 2', 'Chorus'],
      variants: [
        { name: 'full', entries: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus'] },
        { name: 'v1only', entries: ['Verse 1', 'Chorus'] },
      ],
    },
  });
  ok(`PUT pool + varian (${putV.status})`, putV.status === 200
    && JSON.stringify(putV.data.song.arrangements.variants.map((v) => v.name)) === '["full","v1only"]'
    && JSON.stringify(putV.data.song.arrangements.master) === '["Verse 1","Verse 2","Chorus"]');
  const badPool = await admin.put(`/api/songs/${songId}`, {
    arrangements: { master: ['Verse 1'], variants: [{ name: 'x', entries: ['Bridge'] }] },
  });
  ok(`tolak entri di luar pool (400, dapat ${badPool.status})`, badPool.status === 400);
  const badDup = await admin.put(`/api/songs/${songId}`, {
    arrangements: { variants: [{ name: 'a', entries: [] }, { name: 'A', entries: [] }] },
  });
  ok(`tolak nama varian ganda (400, dapat ${badDup.status})`, badDup.status === 400);
  // Kosongkan pemakaian → ikut varian default (full): Dua muncul sebelum Reff kedua? urutan V1,C,V2,C.
  await admin.put(`/api/events/${eventId}/songs/${ss.data.item.id}`, { sections: [] });
  const exp3 = await admin.get(`/api/events/${eventId}/songs/export`);
  const mine3 = (exp3.data.items || []).find((i) => i.songId === songId);
  const q3 = mine3?.quickLyrics || '';
  ok('default varian full dipakai',
    q3.indexOf('Satu') < q3.indexOf('Reff') && q3.indexOf('Dua') < q3.lastIndexOf('Reff')
    && q3.indexOf('Dua') > q3.indexOf('Reff'));
  // Salinan beku: pilih v1only (copy entries) → Dua hilang.
  await admin.put(`/api/events/${eventId}/songs/${ss.data.item.id}`, { sections: ['Verse 1', 'Chorus'] });
  const exp4 = await admin.get(`/api/events/${eventId}/songs/export`);
  const mine4 = (exp4.data.items || []).find((i) => i.songId === songId);
  ok('salinan v1only (tanpa Dua)',
    !!mine4 && mine4.quickLyrics.includes('Satu') && !mine4.quickLyrics.includes('Dua'));

  // 5. Bersih-bersih.
  await admin.delete(`/api/events/${eventId}/songs/${ss.data.item.id}`);
  const del = await admin.delete(`/api/songs/${songId}`);
  ok(`lagu QA terhapus (${del.status})`, del.status === 200);

  console.log(`\n✓ QA SUSUNAN MASTER LULUS (${pass} cek).`);
})().catch((e) => {
  console.error(`\n✗ QA GAGAL: ${e.message}`);
  process.exit(1);
});
