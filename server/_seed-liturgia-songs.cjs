/**
 * Seed pustaka lagu Liturgia (idempotent):
 * - Metadata KJ 1–478 + NKB 1–230 dari server/seed-data/songs-hymns.json
 * - Metadata NNBT 1–50 (GMIM) dari server/seed-data/songs-nnbt.json
 * - Metadata PKJ 1–308 (YAMUGER) dari server/seed-data/songs-pkj.json
 * - Metadata KLIK (GMIM, ±480 incl. varian 203A/451b/464b) dari songs-klik.json
 *   (judul terverifikasi dari alkitab.app; TANPA full lirik —
 *   hormati hak cipta YLSA/YAMUGER/BPMS GMIM/penerbit,
 *   tim membuka tautan sumber dari UI).
 * - 1 lagu contoh LOKAL milik tim (dengan ChordPro) sebagai pola input pemusik.
 * - Kontemporer ID/EN (±50, terkurasi) dari server/seed-data/songs-contemporary.json
 *   (metadata + artis + tautan unlimitedworship/suaranafiri terverifikasi;
 *   TANPA lirik — hormati label/artis; lewati judul yang sudah ada di
 *   himne/KLIK).
 * - Lagu SEKULER tidak di-seed massal (hak cipta label) — input manual via UI.
 *
 * Jalankan: npm run db:seed:liturgia-songs[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const SABDA_KJ = (n) => `https://alkitab.sabda.org/resource.php?res=kidung_jemaat&topic=${n}`;
const SABDA_NKB = (n) => `https://alkitab.sabda.org/resource.php?res=nkb&topic=${n}`;
const ALKITAB_APP = (book, n) => `https://alkitab.app/${book}/${n}`;

const HYMNS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-hymns.json'), 'utf8'),
);
const KJ = HYMNS.kj;
const NKB = HYMNS.nkb;
const NNBT = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-nnbt.json'), 'utf8'),
).nnbt;
const PKJ = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-pkj.json'), 'utf8'),
).pkj;
const KLIK = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-klik.json'), 'utf8'),
).klik;
const CONTEMPORARY = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-contemporary.json'), 'utf8'),
).contemporary;

const LOKAL_SAMPLE = {
  title: 'Kasih Setia-Mu (Contoh Tim)',
  source: 'LOKAL',
  sourceRef: 'LOKAL-CONTOH-001',
  authors: 'Tim Musik Pemuda',
  defaultKey: 'G',
  lyricsChordPro: [
    '[Verse 1]',
    '[G]Kasih setia-Mu [C]tak pernah [G]berakhir,',
    '[Em]setiap pagi [C]selalu [D]baru.',
    '',
    '[Chorus]',
    '[G]Besar setia-Mu, [C]besar setia-Mu,',
    '[Em]tiada yang seperti [D]Engkau, [G]Tuhan.',
  ].join('\n'),
};

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  let added = 0;
  let kept = 0;
  let skipped = 0;
  const upsert = async (row) => {
    const [ex] = await conn.query(
      `SELECT id FROM songs WHERE source = ? AND source_ref = ? LIMIT 1`,
      [row.source, row.sourceRef],
    );
    if (ex.length) {
      kept += 1;
      return;
    }
    await conn.query(
      `INSERT INTO songs (id, title, source, source_ref, source_url, authors, copyright, ccli, default_key, tempo, lyrics_chord_pro, lang, tenant_scope, is_active, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GLOBAL', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [
        `sng-${crypto.randomUUID()}`,
        row.title,
        row.source,
        row.sourceRef,
        row.sourceUrl || null,
        row.authors || null,
        row.copyright || null,
        row.ccli || null,
        row.defaultKey || null,
        row.tempo || null,
        row.lyricsChordPro || null,
        row.lang || 'ID',
      ],
    );
    added += 1;
    console.log(`+ ${row.sourceRef} — ${row.title}`);
  };

  for (const k of KJ) {
    await upsert({
      title: k.title,
      source: 'HIMNE_KJ',
      sourceRef: `KJ ${k.n}`,
      sourceUrl: SABDA_KJ(k.n),
      authors: k.authors || null,
      copyright: '© Yayasan Lembaga SABDA (YLSA) — lihat tautan sumber',
    });
  }
  for (const k of NKB) {
    await upsert({
      title: k.title,
      source: 'HIMNE_NKB',
      sourceRef: `NKB ${k.n}`,
      sourceUrl: SABDA_NKB(k.n),
      authors: null,
      copyright: '© Tim Nyanyian GKI / penerbit — lihat tautan sumber',
    });
  }
  for (const k of NNBT) {
    await upsert({
      title: k.title,
      source: 'HIMNE_NNBT',
      sourceRef: `NNBT ${k.n}`,
      sourceUrl: ALKITAB_APP('NNBT', k.n),
      authors: null,
      copyright: '© BPMS GMIM — lihat tautan sumber',
    });
  }
  for (const k of PKJ) {
    await upsert({
      title: k.title,
      source: 'HIMNE_PKJ',
      sourceRef: `PKJ ${k.n}`,
      sourceUrl: ALKITAB_APP('PKJ', k.n),
      authors: null,
      copyright: '© YAMUGER — lihat tautan sumber',
    });
  }
  for (const k of KLIK) {
    await upsert({
      title: k.title,
      source: 'KLIK',
      sourceRef: `KLIK ${k.n}`,
      sourceUrl: ALKITAB_APP('KLIK', k.n),
      authors: null,
      copyright: '© GMIM / pencipta — lihat tautan sumber',
    });
  }
  // Kontemporer: lewati judul yang sudah ada di himne/KLIK (duplikat lintas-buku).
  const [hymnRows] = await conn.query(
    `SELECT LOWER(title) AS t FROM songs WHERE source IN ('HIMNE_KJ','HIMNE_NKB','HIMNE_NNBT','HIMNE_PKJ','KLIK')`,
  );
  const hymnTitles = new Set(hymnRows.map((r) => r.t));
  for (const k of CONTEMPORARY) {
    if (hymnTitles.has(String(k.title).toLowerCase())) {
      skipped += 1;
      console.log(`= lewati (duplikat himne/KLIK): ${k.title}`);
      continue;
    }
    await upsert({
      title: k.title,
      source: 'KONTEMPORER',
      sourceRef: k.n,
      sourceUrl: k.url,
      authors: k.artists || null,
      copyright: k.copyright || null,
      lang: k.lang || 'ID',
    });
  }
  await upsert(LOKAL_SAMPLE);

  await conn.end();
  console.log(`✓ Selesai (tambah ${added}, sudah ada ${kept}, lewati duplikat ${skipped}).`);
})().catch((e) => {
  console.error('Gagal seed liturgia-songs:', e?.message || e);
  process.exit(1);
});
