/**
 * Seed placeholder visual ke Shared Drive staging.
 * Idempotent: file dengan stem yang sama dilewati.
 *
 * Prasyarat: GDRIVE_ROOT_FOLDER_ID + service account sebagai CONTENT MANAGER.
 * Jalankan: npm run drive:seed-visuals
 */
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { PNG } from 'pngjs';
import {
  VISUAL_SLOTS,
  WEBSITE_VISUAL_FOLDER,
  fileNameOf,
  stemOfFileName,
  buildPetaVisualText,
  websiteVisualFolderSpec,
} from './lib/website-visuals.mjs';

const WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function getWriteDrive() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    throw new Error('Kredensial service account tidak ditemukan di .env');
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [WRITE_SCOPE],
    subject: process.env.GDRIVE_IMPERSONATE || undefined,
  });
  return google.drive({ version: 'v3', auth });
}

const GLYPHS = {
  ' ': [0, 0, 0, 0, 0],
  '-': [0, 0, 7, 0, 0],
  '.': [0, 0, 0, 0, 4],
  '/': [1, 2, 2, 4, 4],
  0: [7, 5, 5, 5, 7],
  1: [2, 6, 2, 2, 7],
  2: [7, 1, 7, 4, 7],
  3: [7, 1, 7, 1, 7],
  4: [5, 5, 7, 1, 1],
  5: [7, 4, 7, 1, 7],
  6: [7, 4, 7, 5, 7],
  7: [7, 1, 2, 2, 2],
  8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [7, 4, 4, 4, 7],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [7, 4, 5, 5, 7],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 7],
  K: [5, 6, 4, 6, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [5, 7, 7, 7, 5],
  O: [7, 5, 5, 5, 7],
  P: [7, 5, 7, 4, 4],
  Q: [7, 5, 5, 7, 3],
  R: [6, 5, 6, 5, 5],
  S: [7, 4, 7, 1, 7],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
};

function drawText(png, text, x0, y0, scale, r, g, b) {
  let x = x0;
  const s = String(text || '').toUpperCase();
  for (const ch of s) {
    const glyph = GLYPHS[ch] || GLYPHS['-'];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row] & (4 >> col)) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const px = x + col * scale + dx;
              const py = y0 + row * scale + dy;
              if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
              const idx = (png.width * py + px) << 2;
              png.data[idx] = r;
              png.data[idx + 1] = g;
              png.data[idx + 2] = b;
              png.data[idx + 3] = 255;
            }
          }
        }
      }
    }
    x += 4 * scale;
  }
}

const FOLDER_COLORS = {
  landing: [255, 65, 108],
  warta: [24, 24, 24],
  kegiatan: [246, 174, 74],
  benzarpreneurship: [246, 174, 74],
  kelompok: [0, 180, 216],
  pengurus: [88, 80, 140],
  testimoni: [46, 160, 110],
};

function labeledPng(slot) {
  const w = 960;
  const h = 540;
  const png = new PNG({ width: w, height: h });
  const [cr, cg, cb] = FOLDER_COLORS[slot.folder] || [27, 27, 27];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) << 2;
      const fade = 0.35 + (y / h) * 0.45;
      png.data[idx] = Math.round(cr * fade);
      png.data[idx + 1] = Math.round(cg * fade);
      png.data[idx + 2] = Math.round(cb * fade);
      png.data[idx + 3] = 255;
    }
  }
  drawText(png, 'GEHC PLACEHOLDER', 40, 40, 4, 255, 255, 255);
  drawText(png, fileNameOf(slot), 40, 90, 3, 255, 255, 255);
  const loc = String(slot.usedAt || '').slice(0, 48);
  drawText(png, loc, 40, 140, 2, 250, 250, 250);
  drawText(png, 'REPLACE THIS FILE  SAME NAME', 40, 460, 3, 255, 255, 255);
  return PNG.sync.write(png);
}

async function childrenOf(drive, parentId, mimeFilter) {
  const map = new Map();
  let pageToken;
  do {
    const q = mimeFilter
      ? `'${parentId}' in parents and mimeType='${mimeFilter}' and trashed=false`
      : `'${parentId}' in parents and trashed=false`;
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    for (const f of res.data.files || []) map.set(f.name.toLowerCase(), f);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return map;
}

async function ensureFolder(drive, name, parentId) {
  const kids = await childrenOf(drive, parentId, FOLDER_MIME);
  const existing = kids.get(name.toLowerCase());
  if (existing) return existing.id;
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  console.log(`  + folder ${name}`);
  return res.data.id;
}

async function uploadBuffer(drive, parentId, name, mimeType, buffer) {
  const res = await drive.files.create({
    requestBody: { name, mimeType, parents: [parentId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return res.data;
}

async function upsertTextFile(drive, parentId, name, text) {
  const kids = await childrenOf(drive, parentId, null);
  const existing = kids.get(name.toLowerCase());
  const body = Buffer.from(text, 'utf8');
  if (existing) {
    await drive.files.update({
      fileId: existing.id,
      media: { mimeType: 'text/plain', body: Readable.from(body) },
      supportsAllDrives: true,
    });
    console.log(`  • ${name}  (diperbarui)`);
    return existing.id;
  }
  await uploadBuffer(drive, parentId, name, 'text/plain', body);
  console.log(`  + ${name}`);
}

function writeLocalPlaceholders() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'visual-placeholders');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '_PETA-VISUAL.txt'), buildPetaVisualText(), 'utf8');
  let n = 0;
  for (const slot of VISUAL_SLOTS) {
    if (slot.seed === false) continue;
    const folder = join(dir, slot.folder);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, fileNameOf(slot)), labeledPng(slot));
    n += 1;
  }
  console.log(`Placeholder lokal: ${n} file di ${dir}`);
  console.log('Seret folder ini ke Website Visual [PUBLIK] di Drive (nama file jangan diubah).');
  return dir;
}

async function main() {
  if (process.argv.includes('--local')) {
    writeLocalPlaceholders();
    process.exit(0);
  }

  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId || rootId === 'fld-root-gehc-01' || rootId.includes('drive.google.com')) {
    throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set dengan ID bare yang benar di .env');
  }

  const drive = getWriteDrive();
  const rootMeta = await drive.files.get({
    fileId: rootId,
    fields: 'id, name, driveId, mimeType',
    supportsAllDrives: true,
  });
  if (!rootMeta.data.driveId && !process.env.GDRIVE_IMPERSONATE) {
    console.warn(
      'Peringatan: folder root tidak di Shared Drive. Service account tidak punya kuota My Drive.\n' +
        '  → Pindahkan root ke Shared Drive, ATAU set GDRIVE_IMPERSONATE ke email Workspace yang punya kuota.\n'
    );
  }
  console.log(`Seed visual ke root ${rootId}${rootMeta.data.driveId ? ` (shared drive ${rootMeta.data.driveId})` : ''}…`);

  const ids = new Map([['ROOT', rootId]]);
  for (const item of websiteVisualFolderSpec()) {
    const parentId = ids.get(item.parent);
    if (!parentId) throw new Error(`parent "${item.parent}" belum tersedia`);
    const id = await ensureFolder(drive, item.name, parentId);
    if (item.key) ids.set(item.key, id);
  }

  const visualRoot = ids.get('WEBSITE_VISUAL');
  await upsertTextFile(drive, visualRoot, '_PETA-VISUAL.txt', buildPetaVisualText());

  let created = 0;
  let skipped = 0;
  for (const slot of VISUAL_SLOTS) {
    if (slot.seed === false) continue;
    const folderId = ids.get(`visual:${slot.folder}`);
    if (!folderId) throw new Error(`folder ${slot.folder} belum ada`);
    const kids = await childrenOf(drive, folderId, null);
    const exists = [...kids.values()].some((f) => stemOfFileName(f.name) === slot.stem.toLowerCase());
    if (exists) {
      skipped += 1;
      console.log(`  • ${slot.folder}/${fileNameOf(slot)}  (sudah ada)`);
      continue;
    }
    const png = labeledPng(slot);
    await uploadBuffer(drive, folderId, fileNameOf(slot), 'image/png', png);
    created += 1;
    console.log(`  + ${slot.folder}/${fileNameOf(slot)}`);
  }

  console.log(`\nSelesai — baru: ${created}, dilewati: ${skipped}.`);
  console.log(`Folder: ${WEBSITE_VISUAL_FOLDER}`);
  process.exit(0);
}

main().catch((e) => {
  const msg = e?.errors?.[0]?.message || e.message || e;
  if (/insufficientFilePermissions|The user does not have sufficient/i.test(msg)) {
    console.error('\nIZIN KURANG: share Shared Drive ke service account sebagai CONTENT MANAGER.\n');
  }
  if (/storage quota/i.test(msg)) {
    console.error('\nKUOTA SA: unggah file harus ke Shared Drive (bukan My Drive yang di-share).');
    console.error('Opsi: tambahkan SA sebagai anggota Shared Drive, atau set GDRIVE_IMPERSONATE.\n');
    try {
      writeLocalPlaceholders();
    } catch (err) {
      console.error(err.message || err);
    }
  }
  console.error(msg);
  process.exit(1);
});
