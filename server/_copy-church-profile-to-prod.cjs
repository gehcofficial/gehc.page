/**
 * Salin Info Gereja (church_profile singleton + profil unit di tenants)
 * dari DB STAGING ke DB PRODUCTION.
 *
 * Aman & idempotent: tanpa DROP, hanya kolom profil yang disentuh.
 * Default DRY-RUN. Tulis ke prod hanya dengan `--apply`.
 *
 * Flags:
 *   --apply            benar-benar menulis ke prod (tanpa ini = dry-run)
 *   --skip-empty       jangan menimpa nilai prod yang sudah terisi dengan kosong
 *   --only=church      hanya church_profile
 *   --only=tenants     hanya tenants
 *
 * Env (dari .env): DATABASE_URL_STAGING, DATABASE_URL_PRODUCTION
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');
const SKIP_EMPTY = process.argv.includes('--skip-empty');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';

const PROFILE_ID = 'church-profile';
const PROFILE_COLUMNS = [
  'name',
  'tagline',
  'description',
  'address_text',
  'map_share_url',
  'map_embed_query',
  'contact_email',
  'contact_phone',
  'whatsapp',
  'schedules',
  'socials',
];
const UNIT_COLUMNS = ['tagline', 'contact_email', 'socials'];

function connConfig(raw, label) {
  if (!raw) throw new Error(`${label} kosong di .env`);
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  };
}

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

/** JSON/objek → string untuk kolom JSON; null tetap null. */
function jsonOut(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** Pilih nilai sumber; bila kosong & --skip-empty & target terisi → pakai target. */
function pick(srcVal, targetVal, asJson = false) {
  const src = asJson ? jsonOut(srcVal) : srcVal;
  if (isEmpty(src) && SKIP_EMPTY && !isEmpty(targetVal)) return targetVal;
  return src;
}

async function main() {
  const src = await mysql.createConnection(connConfig(process.env.DATABASE_URL_STAGING, 'DATABASE_URL_STAGING'));
  const dst = await mysql.createConnection(connConfig(process.env.DATABASE_URL_PRODUCTION, 'DATABASE_URL_PRODUCTION'));
  console.log(`Mode: ${APPLY ? 'APPLY (tulis prod)' : 'DRY-RUN'} | skip-empty=${SKIP_EMPTY} | only=${ONLY}`);

  try {
    // ---------- church_profile ----------
    if (ONLY === 'all' || ONLY === 'church') {
      const [rows] = await src.query(`SELECT * FROM church_profile WHERE id = ? LIMIT 1`, [PROFILE_ID]);
      const row = rows[0];
      if (!row) {
        console.log('church_profile: tidak ada baris sumber — dilewati.');
      } else {
        const [tRows] = await dst.query(`SELECT * FROM church_profile WHERE id = ? LIMIT 1`, [PROFILE_ID]);
        const target = tRows[0] || {};
        const values = PROFILE_COLUMNS.map((c) => pick(row[c], target[c], c === 'schedules' || c === 'socials'));
        const changed = PROFILE_COLUMNS.filter((c, i) => {
          const s = c === 'schedules' || c === 'socials' ? jsonOut(row[c]) : row[c];
          return String(values[i] ?? '') !== String((target[c] ?? '')) && !(isEmpty(s) && SKIP_EMPTY);
        });
        console.log(`church_profile: akan update ${changed.length} kolom (${changed.join(', ') || 'tidak ada'}).`);

        if (APPLY) {
          const insertCols = ['id', ...PROFILE_COLUMNS, 'updated_at'];
          const insertVals = [PROFILE_ID, ...values, new Date()];
          const placeholders = insertCols.map(() => '?').join(', ');
          const updates = PROFILE_COLUMNS.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ') + ', `updated_at`=VALUES(`updated_at`)';
          await dst.query(
            `INSERT INTO church_profile (${insertCols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
            insertVals,
          );
          console.log('church_profile: tersimpan ke prod.');
        }
      }
    }

    // ---------- tenants (profil unit) ----------
    if (ONLY === 'all' || ONLY === 'tenants') {
      const [srcUnits] = await src.query(`SELECT slug, tagline, contact_email, socials FROM tenants`);
      let updated = 0;
      let skipped = 0;
      for (const u of srcUnits) {
        const [tRows] = await dst.query(`SELECT slug, tagline, contact_email, socials FROM tenants WHERE slug = ? LIMIT 1`, [u.slug]);
        const target = tRows[0];
        if (!target) { skipped += 1; continue; }
        const values = UNIT_COLUMNS.map((c) => pick(u[c], target[c], c === 'socials'));
        const changed = UNIT_COLUMNS.filter((c, i) => String(values[i] ?? '') !== String(target[c] ?? ''));
        if (!changed.length) { skipped += 1; continue; }
        console.log(`tenant ${u.slug}: update ${changed.join(', ')}`);
        if (APPLY) {
          await dst.query(
            `UPDATE tenants SET tagline = ?, contact_email = ?, socials = ? WHERE slug = ?`,
            [values[0], values[1], values[2], u.slug],
          );
        }
        updated += 1;
      }
      console.log(`tenants: ${updated} unit ${APPLY ? 'tersimpan' : 'akan diupdate'}, ${skipped} dilewati.`);
    }

    if (!APPLY) console.log('\nDRY-RUN selesai. Jalankan ulang dengan --apply untuk menulis ke prod.');
    else console.log('\nAPPLY selesai.');
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
