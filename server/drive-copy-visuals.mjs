/**
 * Salin Website Visual [PUBLIK] dari Drive staging → production.
 * Replace-in-place by stem (hapus duplikat Unsplash di tujuan).
 *
 *   npm run drive:auth
 *   npm run drive:copy-visuals:staging-to-prod
 *   npm run drive:copy-visuals:staging-to-prod -- --dry-run
 *   npm run drive:copy-visuals:staging-to-prod -- --folder=landing
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { readEnvMap } from '../scripts/env-config.mjs';
import { getUserDrive, hasUserDriveToken } from './lib/gdrive-user-oauth.mjs';
import {
  WEBSITE_VISUAL_FOLDER,
  WEBSITE_VISUAL_SUBFOLDERS,
  stemOfFileName,
} from './lib/website-visuals.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SKIP_MIME = /^application\/vnd\.google-apps\./;

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const eq = process.argv.find((a) => a.startsWith('--folder='));
  const inline =
    process.argv.includes('--folder') && process.argv[process.argv.indexOf('--folder') + 1];
  const raw = eq ? eq.slice('--folder='.length) : inline;
  let folder = raw ? String(raw).toLowerCase().trim() : null;
  if (folder && !WEBSITE_VISUAL_SUBFOLDERS.includes(folder)) {
    console.error(`Folder tidak valid: "${raw}"`);
    console.error(`Pilihan: ${WEBSITE_VISUAL_SUBFOLDERS.join(', ')}`);
    process.exit(1);
  }
  return { dryRun, folder };
}

function applyOauthEnv() {
  for (const file of ['.env', '.env.production', '.env.staging']) {
    const map = readEnvMap(join(ROOT, file));
    if (!map) continue;
    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GDRIVE_USER_REFRESH_TOKEN']) {
      if (!process.env[key] && map.get(key)) process.env[key] = map.get(key);
    }
  }
}

function requireRoot(file) {
  const map = readEnvMap(join(ROOT, file));
  if (!map) throw new Error(`${file} tidak ditemukan.`);
  const id = String(map.get('GDRIVE_ROOT_FOLDER_ID') || '').trim();
  if (!id || id.includes('drive.google.com')) {
    throw new Error(`${file} tanpa GDRIVE_ROOT_FOLDER_ID yang valid.`);
  }
  return id;
}

async function listChildren(drive, parentId, mimeFilter) {
  const files = [];
  let pageToken;
  do {
    const q = mimeFilter
      ? `'${parentId}' in parents and mimeType='${mimeFilter}' and trashed=false`
      : `'${parentId}' in parents and trashed=false`;
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function ensureFolder(drive, name, parentId, dryRun) {
  const kids = await listChildren(drive, parentId, FOLDER_MIME);
  const existing = kids.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  if (dryRun) {
    console.log(`  + folder ${name}  (dry-run, belum dibuat)`);
    return null;
  }
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  console.log(`  + folder ${name}`);
  return res.data.id;
}

async function findNamedFolder(drive, parentId, name) {
  const kids = await listChildren(drive, parentId, FOLDER_MIME);
  return kids.find((f) => f.name.toLowerCase() === name.toLowerCase()) || null;
}

async function folderMeta(drive, folderId) {
  const res = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, driveId, mimeType',
    supportsAllDrives: true,
  });
  return res.data;
}

function mimeOf(file) {
  const mime = file.mimeType || 'application/octet-stream';
  if (mime && mime !== 'application/octet-stream') return mime;
  const n = String(file.name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.txt')) return 'text/plain';
  return 'image/jpeg';
}

async function downloadBytes(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

function newestByStem(files, stem) {
  const matches = files.filter((f) => stemOfFileName(f.name) === stem);
  matches.sort((a, b) => Date.parse(b.modifiedTime || 0) - Date.parse(a.modifiedTime || 0));
  return matches;
}

async function trashFile(drive, fileId) {
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

async function upsertFile(drive, destFolderId, destFiles, source, buffer, dryRun) {
  const stem = stemOfFileName(source.name);
  const matches = newestByStem(destFiles, stem);
  const mime = mimeOf(source);
  const keep = matches[0] || null;
  const extras = matches.slice(1);

  if (dryRun) {
    if (keep) console.log(`  • ${source.name}  → replace ${keep.name}`);
    else console.log(`  + ${source.name}  → unggah baru`);
    for (const extra of extras) console.log(`    ↳ trash duplikat ${extra.name}`);
    return keep ? 'replace' : 'create';
  }

  if (keep) {
    await drive.files.update({
      fileId: keep.id,
      requestBody: { name: source.name },
      media: { mimeType: mime, body: Readable.from(buffer) },
      supportsAllDrives: true,
    });
    for (const extra of extras) {
      await trashFile(drive, extra.id);
      console.log(`    ↳ trash duplikat ${extra.name}`);
    }
    console.log(`  • ${source.name}  (replace)`);
    return 'replace';
  }

  await drive.files.create({
    requestBody: { name: source.name, mimeType: mime, parents: [destFolderId] },
    media: { mimeType: mime, body: Readable.from(buffer) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  console.log(`  + ${source.name}`);
  return 'create';
}

function copyable(file) {
  if (!file?.name || file.mimeType === FOLDER_MIME) return false;
  if (SKIP_MIME.test(file.mimeType || '')) return false;
  return true;
}

async function copyFolderFiles(drive, sourceId, destId, label, dryRun) {
  if (!destId && !dryRun) throw new Error(`Folder tujuan ${label} belum ada.`);
  const sourceFiles = (await listChildren(drive, sourceId, null)).filter(copyable);
  const destFiles = destId ? (await listChildren(drive, destId, null)).filter(copyable) : [];
  let created = 0;
  let replaced = 0;
  let skipped = 0;

  if (!sourceFiles.length) {
    console.log(`  · kosong`);
    return { created, replaced, skipped };
  }

  for (const file of sourceFiles) {
    try {
      const buffer = dryRun ? Buffer.alloc(0) : await downloadBytes(drive, file.id);
      const action = await upsertFile(drive, destId, destFiles, file, buffer, dryRun);
      if (action === 'replace') {
        replaced += 1;
        if (destFiles.length) {
          const idx = destFiles.findIndex((f) => stemOfFileName(f.name) === stemOfFileName(file.name));
          if (idx >= 0) destFiles[idx] = { ...destFiles[idx], name: file.name };
        }
      } else {
        created += 1;
        destFiles.push({ id: 'new', name: file.name, mimeType: file.mimeType, modifiedTime: new Date().toISOString() });
      }
    } catch (e) {
      skipped += 1;
      console.error(`  ! gagal ${file.name}: ${e.message || e}`);
    }
  }
  return { created, replaced, skipped };
}

async function main() {
  const { dryRun, folder } = parseArgs();
  applyOauthEnv();

  if (!hasUserDriveToken()) {
    throw new Error('Belum ada token Drive. Jalankan: npm run drive:auth');
  }

  const sourceRootId = requireRoot('.env.staging');
  const destRootId = requireRoot('.env.production');
  if (sourceRootId === destRootId) {
    throw new Error('Root staging dan production sama — batalkan supaya Drive staging tidak tertimpa.');
  }

  const drive = await getUserDrive();
  const sourceMeta = await folderMeta(drive, sourceRootId);
  const destMeta = await folderMeta(drive, destRootId);

  console.log(dryRun ? 'DRY-RUN — tidak menulis ke Drive prod\n' : 'Salin Website Visual staging → production\n');
  console.log(`Sumber : ${sourceMeta.name}  (${sourceRootId})`);
  console.log(`Tujuan : ${destMeta.name}  (${destRootId})\n`);

  const sourceVisual = await findNamedFolder(drive, sourceRootId, WEBSITE_VISUAL_FOLDER);
  if (!sourceVisual) {
    throw new Error(`Folder "${WEBSITE_VISUAL_FOLDER}" tidak ada di Drive staging.`);
  }
  const destVisualId = await ensureFolder(drive, WEBSITE_VISUAL_FOLDER, destRootId, dryRun);
  if (!destVisualId && !dryRun) throw new Error('Gagal memastikan folder visual di prod.');

  const totals = { created: 0, replaced: 0, skipped: 0 };
  const folders = folder ? [folder] : [...WEBSITE_VISUAL_SUBFOLDERS];

  if (!folder) {
    console.log(`${WEBSITE_VISUAL_FOLDER}/  (_PETA + file di root visual)`);
    const rootStats = await copyFolderFiles(drive, sourceVisual.id, destVisualId, WEBSITE_VISUAL_FOLDER, dryRun);
    totals.created += rootStats.created;
    totals.replaced += rootStats.replaced;
    totals.skipped += rootStats.skipped;
  }

  for (const name of folders) {
    console.log(`\n${name}/`);
    const sourceSub = await findNamedFolder(drive, sourceVisual.id, name);
    if (!sourceSub) {
      console.log('  · tidak ada di staging');
      continue;
    }
    const destSubId = destVisualId
      ? await ensureFolder(drive, name, destVisualId, dryRun)
      : null;
    const stats = await copyFolderFiles(drive, sourceSub.id, destSubId, name, dryRun);
    totals.created += stats.created;
    totals.replaced += stats.replaced;
    totals.skipped += stats.skipped;
  }

  console.log(`\nSelesai — baru: ${totals.created}, replace: ${totals.replaced}, gagal: ${totals.skipped}.`);
  if (dryRun) console.log('Jalankan tanpa --dry-run untuk menulis ke Drive production.');
  else {
    console.log('Drive prod sekarang memegang foto staging (stem sama).');
    console.log('Website prod tetap memakai public/visuals/ sampai pull+commit (opsional).');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
