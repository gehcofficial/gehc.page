/**
 * Seed pustaka lagu Liturgia (idempotent):
 * - Metadata KJ 1–10 (judul + pencipta terverifikasi dari
 *   alkitab.sabda.org/resource.php?res=kidung_jemaat; TANPA full lirik —
 *   hormati hak cipta YLSA, tim membuka tautan SABDA dari UI).
 * - 1 lagu contoh LOKAL milik tim (dengan ChordPro) sebagai pola input pemusik.
 *
 * Jalankan: npm run db:seed:liturgia-songs[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');

const SABDA_KJ = (n) => `https://alkitab.sabda.org/resource.php?res=kidung_jemaat&topic=${n}`;

const KJ = [
  { n: 1, title: 'Haleluya, Pujilah', authors: null },
  { n: 2, title: 'Suci, Suci, Suci', authors: 'Reginald Heber; John Bacchus Dykes' },
  { n: 3, title: 'Kami Puji dengan Riang', authors: 'Henry van Dyke; Ludwig van Beethoven' },
  { n: 4, title: 'Hai Mari Sembah', authors: 'O Worship The King; Johann Michael Haydn' },
  { n: 5, title: 'Tuhan Allah, NamaMu', authors: 'Ignaz Franz' },
  { n: 6, title: 'Hai Masyhurkanlah', authors: 'Charles Wesley' },
  { n: 7, title: 'Ya Tuhan, Kami Puji NamaMu Besar', authors: 'Ahaverus van den Berg' },
  { n: 8, title: 'BagiMu Tuhan, Nyanyianku', authors: 'Bartholomaus Crasselius' },
  { n: 9, title: 'Puji, Hai Jiwaku, Puji Tuhan', authors: 'Johann Daniel Herrnschmidt' },
  { n: 10, title: 'Pujilah Tuhan, Sang Raja', authors: 'Joachim Neander' },
];

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
      authors: k.authors,
      copyright: '© Yayasan Lembaga SABDA (YLSA) — lihat tautan sumber',
    });
  }
  await upsert(LOKAL_SAMPLE);

  await conn.end();
  console.log(`✓ Selesai (tambah ${added}, sudah ada ${kept}).`);
})().catch((e) => {
  console.error('Gagal seed liturgia-songs:', e?.message || e);
  process.exit(1);
});
