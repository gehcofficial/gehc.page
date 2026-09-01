/**
 * Seed foto slot visual ke Drive (Google One via OAuth user).
 * Idempotent: file dengan stem yang sama dilewati.
 *
 *   npm run drive:auth          # sekali — login pemilik Drive
 *   npm run drive:seed-visuals  # unggah Unsplash bernama tetap
 *   npm run drive:seed-visuals:local  # tulis ke scripts/visual-placeholders/
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { PNG } from 'pngjs';
import {
  VISUAL_SLOTS,
  WEBSITE_VISUAL_FOLDER,
  SLOT_SOURCE_URLS,
  fileNameOf,
  stemOfFileName,
  buildPetaVisualText,
  websiteVisualFolderSpec,
} from './lib/website-visuals.mjs';
import { getUserDrive } from './lib/gdrive-user-oauth.mjs';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function gehcMarkPng(size = 512) {
  const png = new PNG({ width: size, height: size });
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) {
        png.data[idx + 3] = 0;
        continue;
      }
      const t = (x + y) / (2 * (size - 1));
      png.data[idx] = 255;
      png.data[idx + 1] = Math.round(65 + (75 - 65) * t);
      png.data[idx + 2] = Math.round(108 + (43 - 108) * t);
      png.data[idx + 3] = d > r - 1.4 ? Math.round(255 * Math.max(0, r - d)) : 255;
    }
  }
  const scale = Math.max(8, Math.floor(size / 32));
  const text = 'GEHC';
  const textW = text.length * 4 * scale;
  const textH = 5 * scale;
  drawText(png, text, Math.round((size - textW) / 2), Math.round((size - textH) / 2), scale, 255, 255, 255);
  return PNG.sync.write(png);
}

function labeledPng(slot) {
  const w = 960;
  const h = 540;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) << 2;
      const fade = 0.35 + (y / h) * 0.45;
      png.data[idx] = Math.round(27 * fade);
      png.data[idx + 1] = Math.round(27 * fade);
      png.data[idx + 2] = Math.round(27 * fade);
      png.data[idx + 3] = 255;
    }
  }
  drawText(png, 'GEHC PLACEHOLDER', 40, 40, 4, 255, 255, 255);
  drawText(png, fileNameOf(slot), 40, 90, 3, 255, 255, 255);
  drawText(png, String(slot.usedAt || '').slice(0, 48), 40, 140, 2, 250, 250, 250);
  drawText(png, 'REPLACE THIS FILE  SAME STEM', 40, 460, 3, 255, 255, 255);
  return PNG.sync.write(png);
}

function findQrisFile() {
  const candidates = [
    join(ROOT_DIR, 'public', 'Gopay QRIS.png'),
    join(ROOT_DIR, 'Gopay QRIS.png'),
    join(ROOT_DIR, 'public', 'gopay-qris.png'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

async function fetchSlotBytes(slot) {
  if (slot.key === 'brand.logoGehc') {
    return { buffer: gehcMarkPng(), mimeType: 'image/png', fileName: `${slot.stem}.png` };
  }
  if (slot.key === 'benzar.qris') {
    const local = findQrisFile();
    if (local) {
      return { buffer: readFileSync(local), mimeType: 'image/png', fileName: `${slot.stem}.png` };
    }
    return { buffer: labeledPng(slot), mimeType: 'image/png', fileName: `${slot.stem}.png` };
  }
  const url = SLOT_SOURCE_URLS[slot.key];
  if (!url) {
    return { buffer: labeledPng(slot), mimeType: 'image/png', fileName: fileNameOf(slot) };
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'gehc.page-drive-seed/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return { buffer, mimeType: mime.startsWith('image/') ? mime : 'image/jpeg', fileName: `${slot.stem}.${ext}` };
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

async function writeLocalPlaceholders() {
  const dir = join(ROOT_DIR, 'scripts', 'visual-placeholders');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '_PETA-VISUAL.txt'), buildPetaVisualText(), 'utf8');
  let n = 0;
  for (const slot of VISUAL_SLOTS) {
    if (slot.seed === false) continue;
    const folder = join(dir, slot.folder);
    mkdirSync(folder, { recursive: true });
    try {
      const { buffer, fileName } = await fetchSlotBytes(slot);
      writeFileSync(join(folder, fileName), buffer);
      n += 1;
    } catch (e) {
      writeFileSync(join(folder, fileNameOf(slot)), labeledPng(slot));
      n += 1;
      console.warn(`  ! ${slot.folder}/${slot.stem} fallback PNG (${e.message})`);
    }
  }
  console.log(`Placeholder lokal: ${n} file di ${dir}`);
  console.log('Seret isi folder ini ke Website Visual [PUBLIK] (stem nama jangan diubah).');
  return dir;
}

async function main() {
  if (process.argv.includes('--local')) {
    await writeLocalPlaceholders();
    process.exit(0);
  }

  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId || rootId === 'fld-root-gehc-01' || rootId.includes('drive.google.com')) {
    throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set dengan ID bare yang benar di .env');
  }

  const drive = await getUserDrive();
  const rootMeta = await drive.files.get({
    fileId: rootId,
    fields: 'id, name, driveId, mimeType',
    supportsAllDrives: true,
  });
  console.log(
    `Seed visual (OAuth Google One) ke root ${rootId}${rootMeta.data.driveId ? ` (shared drive ${rootMeta.data.driveId})` : ' (My Drive)'} — ${rootMeta.data.name || ''}`
  );

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
      console.log(`  • ${slot.folder}/${slot.stem}  (sudah ada)`);
      continue;
    }
    try {
      const { buffer, mimeType, fileName } = await fetchSlotBytes(slot);
      await uploadBuffer(drive, folderId, fileName, mimeType, buffer);
      created += 1;
      console.log(`  + ${slot.folder}/${fileName}`);
    } catch (e) {
      console.error(`  ! gagal ${slot.folder}/${slot.stem}: ${e.message}`);
    }
  }

  console.log(`\nSelesai — baru: ${created}, dilewati: ${skipped}.`);
  console.log(`Folder: ${WEBSITE_VISUAL_FOLDER}`);
  console.log('Website: GET /api/media/slots → source drive setelah cache ~60s.');
  process.exit(0);
}

main().catch(async (e) => {
  const msg = e?.errors?.[0]?.message || e.message || e;
  if (/Belum ada token/i.test(msg)) {
    console.error(msg);
    process.exit(1);
  }
  if (/storage quota/i.test(msg)) {
    console.error('\nMasih memakai identitas tanpa kuota. Pastikan npm run drive:auth memakai akun Google One pemilik Drive.\n');
    try {
      await writeLocalPlaceholders();
    } catch (err) {
      console.error(err.message || err);
    }
  }
  if (/redirect_uri_mismatch/i.test(msg)) {
    console.error('\nTambahkan redirect URI di OAuth client: http://127.0.0.1:8765/drive-auth/callback\n');
  }
  console.error(msg);
  process.exit(1);
});
