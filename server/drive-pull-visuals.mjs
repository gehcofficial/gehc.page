/**
 * Tarik slot visual dari Google Drive → public/visuals/ + manifest.json.
 * Setelah pull: commit public/visuals/ lalu deploy — website pakai CDN edge (cepat).
 *
 *   npm run drive:pull-visuals           # .env (staging root)
 *   npm run drive:pull-visuals:staging   # .env.staging
 *   npm run drive:pull-visuals:prod      # .env.production
 */
import 'dotenv/config';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { getDriveMode, listFolders, listFiles, getFileStream } from './gdrive.mjs';
import { getUserDrive, hasUserDriveToken } from './lib/gdrive-user-oauth.mjs';
import {
  VISUAL_SLOTS,
  WEBSITE_VISUAL_FOLDER,
  matchStem,
} from './lib/website-visuals.mjs';
import {
  VISUALS_DIR,
  MANIFEST_PATH,
  emptySlots,
  assignSlot,
  slotsHasAny,
  staticUrl,
  localPath,
  writeManifest,
} from './lib/static-visuals.mjs';

function pickSlotFile(files, stem) {
  const matches = (files || []).filter((f) => matchStem(f.name, stem));
  if (!matches.length) return null;
  return matches.sort(
    (a, b) => Date.parse(b.modifiedTime || 0) - Date.parse(a.modifiedTime || 0)
  )[0];
}

async function findNamedFolder(parentId, matcher, listFn = listFolders) {
  const folders = await listFn(parentId, 100);
  if (typeof matcher === 'string') {
    const want = matcher.toLowerCase();
    return folders.find((f) => f.name.toLowerCase() === want) || null;
  }
  return folders.find((f) => matcher.test(f.name)) || null;
}

async function findWebsiteVisualRoot(listFn = listFolders) {
  return findNamedFolder(undefined, new RegExp(`^${WEBSITE_VISUAL_FOLDER.replace(/[[\]]/g, '\\$&')}$`, 'i'), listFn);
}

async function listFolderFiles(drive, folderId, pageSize = 50) {
  const q = `'${folderId}' in parents and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: Math.min(pageSize, 50),
    orderBy: 'modifiedTime desc',
    fields:
      'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
  }));
}

async function streamFile(drive, fileId) {
  const content = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return content.data;
}

async function getPullDrive() {
  const useOAuth = process.argv.includes('--oauth');
  if (useOAuth || !getDriveMode()) {
    if (!hasUserDriveToken()) {
      throw new Error('Drive SA tidak tersedia. Jalankan: npm run drive:auth lalu npm run drive:pull-visuals -- --oauth');
    }
    console.log('Mode: OAuth pemilik Drive (Google One)\n');
    return getUserDrive();
  }
  return null;
}

async function listFoldersVia(drive, parentId, pageSize = 50) {
  if (!drive) return listFolders(parentId, pageSize);
  const target = parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';
  const q = `'${target}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: Math.min(pageSize, 100),
    orderBy: 'name',
    fields: 'nextPageToken, files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

async function downloadFile(drive, file, relPath) {
  const dest = localPath(relPath);
  mkdirSync(dirname(dest), { recursive: true });
  const stream = drive ? await streamFile(drive, file.id) : (await getFileStream(file.id)).stream;
  await pipeline(stream, createWriteStream(dest));
  const size = statSync(dest).size;
  if (size > 2_000_000) {
    console.warn(`  ⚠ ${relPath} — ${Math.round(size / 1024 / 1024)}MB (pertimbangkan kompresi sebelum commit)`);
  }
  return statSync(dest).mtimeMs;
}

function relFromFile(folder, fileName) {
  return `${folder}/${fileName}`;
}

async function pullNamedFolder(slots, oauthDrive, folderKey, files, skipPrefix) {
  let count = 0;
  for (const f of files) {
    const stem = String(f.name || '').replace(/\.[^.]+$/, '').toLowerCase();
    if (stem.startsWith(skipPrefix) || stem.startsWith('_')) continue;
    if (!f.mimeType?.startsWith('image/') && !f.mimeType?.startsWith('video/')) continue;
    const rel = relFromFile(folderKey, f.name);
    try {
      const mtime = await downloadFile(oauthDrive, f, rel);
      slots[folderKey][stem] = staticUrl(rel, mtime);
      count += 1;
      console.log(`  + ${rel}`);
    } catch (e) {
      console.error(`  ! gagal ${rel}: ${e.message}`);
    }
  }
  return count;
}

async function main() {
  let oauthDrive = null;
  try {
    oauthDrive = await getPullDrive();
  } catch (e) {
    if (!getDriveMode()) {
      console.error(e.message);
      process.exit(1);
    }
  }

  if (!oauthDrive && !getDriveMode()) {
    console.error('Google Drive belum dikonfigurasi (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).');
    process.exit(1);
  }

  const listFoldersFn = (parentId, size) =>
    oauthDrive ? listFoldersVia(oauthDrive, parentId, size) : listFolders(parentId, size);
  const listFilesFn = async (folderId) => {
    if (oauthDrive) return listFolderFiles(oauthDrive, folderId);
    return listFiles({ folderId, pageSize: 50, fresh: true });
  };

  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID || '(root)';
  console.log(`Pull visual Drive → ${VISUALS_DIR}`);
  console.log(`Root folder: ${rootId}\n`);

  const root = await findNamedFolder(
    undefined,
    new RegExp(`^${WEBSITE_VISUAL_FOLDER.replace(/[[\]]/g, '\\$&')}$`, 'i'),
    listFoldersFn
  );
  if (!root) {
    console.error(`Folder "${WEBSITE_VISUAL_FOLDER}" tidak ditemukan di root Drive.`);
    process.exit(1);
  }

  const subfolders = await listFoldersFn(root.id, 50);
  const byName = new Map(subfolders.map((f) => [f.name.toLowerCase(), f]));
  const slots = emptySlots();
  let downloaded = 0;

  const folderNames = new Set([
    ...VISUAL_SLOTS.map((s) => s.folder.toLowerCase()),
    'pengurus',
    'testimoni',
  ]);
  const foldersToLoad = [...folderNames]
    .map((name) => byName.get(name))
    .filter(Boolean);

  const filesByFolder = new Map();
  await Promise.all(
    foldersToLoad.map(async (folder) => {
      const files = await listFilesFn(folder.id);
      filesByFolder.set(folder.id, files);
    })
  );

  for (const slot of VISUAL_SLOTS) {
    const folder = byName.get(slot.folder.toLowerCase());
    if (!folder) continue;
    const files = filesByFolder.get(folder.id) || [];
    const file = pickSlotFile(files, slot.stem);
    if (!file) {
      console.log(`  · ${slot.folder}/${slot.stem}  (kosong di Drive)`);
      continue;
    }
    const rel = relFromFile(slot.folder, file.name);
    try {
      const mtime = await downloadFile(oauthDrive, file, rel);
      assignSlot(slots, slot.key, staticUrl(rel, mtime));
      downloaded += 1;
      console.log(`  + ${rel}`);
    } catch (e) {
      console.error(`  ! gagal ${rel}: ${e.message}`);
    }
  }

  const pengurusFolder = byName.get('pengurus');
  if (pengurusFolder) {
    downloaded += await pullNamedFolder(
      slots,
      oauthDrive,
      'pengurus',
      filesByFolder.get(pengurusFolder.id) || [],
      'contoh-'
    );
  }

  const testimoniFolder = byName.get('testimoni');
  if (testimoniFolder) {
    downloaded += await pullNamedFolder(
      slots,
      oauthDrive,
      'testimoni',
      filesByFolder.get(testimoniFolder.id) || [],
      'contoh-'
    );
  }

  if (!slotsHasAny(slots)) {
    console.error('\nTidak ada file visual yang berhasil ditarik.');
    process.exit(1);
  }

  const manifest = writeManifest({ slots, rootFolderId: root.id });
  console.log(`\nSelesai — unduh: ${downloaded} file.`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Synced: ${manifest.syncedAt}`);
  console.log('\nLangkah berikutnya:');
  console.log('  git add public/visuals/');
  console.log('  git commit -m "chore(visuals): sync from Drive"');
  console.log('  git push → deploy staging/production');
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
