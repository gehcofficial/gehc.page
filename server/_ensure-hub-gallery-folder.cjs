/**
 * Pastikan folder galeri hub ada: `Website Visual [PUBLIK]/hub/`.
 * Hanya menyentuh 2 folder (Website Visual + hub) — tidak menyentuh struktur lain.
 *
 * Jalankan:
 *   npm run drive:ensure-hub          (staging, .env)
 *   npm run drive:ensure-hub:prod     (.env.production)
 *
 * Idempotent. Pakai service account (butuh Content Manager di root Drive).
 */
require('dotenv').config();
const { readFileSync } = require('node:fs');
const { google } = require('googleapis');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const WEBSITE_VISUAL_FOLDER = 'Website Visual [PUBLIK]';
const HUB_FOLDER = 'hub';
const WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';

function getWriteDrive() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    throw new Error('Kredensial service account tidak ditemukan (GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON).');
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [WRITE_SCOPE],
    subject: process.env.GDRIVE_IMPERSONATE || undefined,
  });
  return google.drive({ version: 'v3', auth });
}

async function findChild(drive, parentId, name) {
  const want = String(name).toLowerCase();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files || []).find((f) => String(f.name || '').toLowerCase() === want) || null;
}

async function ensureFolder(drive, parentId, name) {
  const existing = await findChild(drive, parentId, name);
  if (existing) {
    console.log(`  • ${name}  (sudah ada)`);
    return existing;
  }
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  console.log(`  + ${name}  (dibuat)`);
  return res.data;
}

(async () => {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId || rootId.includes('drive.google.com')) {
    throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set dengan ID bare yang benar.');
  }
  const drive = getWriteDrive();
  console.log('Memastikan folder galeri hub…');
  const visual = await ensureFolder(drive, rootId, WEBSITE_VISUAL_FOLDER);
  const hub = await ensureFolder(drive, visual.id, HUB_FOLDER);
  console.log('\n✓ Selesai');
  console.log(`  Website Visual : ${visual.id}`);
  console.log(`  hub            : ${hub.id}`);
  console.log(`  link           : https://drive.google.com/drive/folders/${hub.id}`);
  console.log('\nTaruh foto publik di folder "hub" — galeri gehc.page muncul (≥4 foto).');
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
