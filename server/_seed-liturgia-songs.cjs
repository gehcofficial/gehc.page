/**
 * Seed pustaka lagu Liturgia (idempotent):
 * - Metadata FULL KJ 1–478 + NKB 1–230 dari server/seed-data/songs-hymns.json
 *   (judul terverifikasi dari alkitab.sabda.org; TANPA full lirik —
 *   hormati hak cipta YLSA/penerbit, tim membuka tautan SABDA dari UI).
 * - 1 lagu contoh LOKAL milik tim (dengan ChordPro) sebagai pola input pemusik.
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

const HYMNS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data', 'songs-hymns.json'), 'utf8'),
);
const KJ = HYMNS.kj;
const NKB = HYMNS.nkb;

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
      `INSERT INTO songs (id, title, source, source_ref, source_url, authors, copyright, ccli, default_key, tempo, lyrics_chord_pro, tenant_scope, is_active, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GLOBAL', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
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
  await upsert(LOKAL_SAMPLE);

  await conn.end();
  console.log(`✓ Selesai (tambah ${added}, sudah ada ${kept}).`);
})().catch((e) => {
  console.error('Gagal seed liturgia-songs:', e?.message || e);
  process.exit(1);
});
