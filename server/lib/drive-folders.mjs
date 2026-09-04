/**
 * Ensure folder path + unggah JPEG ke Drive (OAuth pemilik).
 */
import { Readable } from 'node:stream';
import { getUserDrive, hasUserDriveToken } from './gdrive-user-oauth.mjs';
import { WEBSITE_VISUAL_FOLDER } from './website-visuals.mjs';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function driveThumbUrl(fileId, size = 1200) {
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}=s${size}`;
}

export function driveViewUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function slugFolderPart(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function albumFolderName(occurredOn, title) {
  const day = String(occurredOn || '').slice(0, 10);
  const rest = slugFolderPart(title) || 'kegiatan';
  return `${day} ${rest}`.trim();
}

export function archiveFolderName(occurredOn, title) {
  const ym = String(occurredOn || '').slice(0, 7);
  const rest = slugFolderPart(title) || 'acara';
  return `${ym} ${rest}`.trim();
}

export async function listNamedFolders(drive, parentId) {
  const target = parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';
  const q = `'${target}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 100,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

export async function findNamed(drive, parentId, name) {
  const want = String(name).toLowerCase();
  const folders = await listNamedFolders(drive, parentId);
  return folders.find((f) => String(f.name || '').toLowerCase() === want) || null;
}

export async function ensureNamedFolder(drive, parentId, name) {
  const existing = await findNamed(drive, parentId, name);
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root'],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return created.data;
}

/** Walk ROOT → names[], create missing. */
export async function ensureFolderPath(drive, names, startId) {
  let parentId = startId || process.env.GDRIVE_ROOT_FOLDER_ID;
  let node = { id: parentId, name: 'ROOT' };
  for (const name of names) {
    node = await ensureNamedFolder(drive, parentId, name);
    parentId = node.id;
  }
  return node;
}

export async function listFolderFiles(drive, folderId, pageSize = 100) {
  const q = `'${folderId}' in parents and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize,
    fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

function stemOf(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
}

export async function deleteStemInFolder(drive, folderId, stem) {
  const files = await listFolderFiles(drive, folderId);
  const want = String(stem).toLowerCase();
  for (const f of files) {
    if (stemOf(f.name) === want && f.mimeType !== FOLDER_MIME) {
      try {
        await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @param {{ publicReader?: boolean, filename?: string }} [opts]
 */
export async function uploadJpegToFolder(drive, folderId, jpegBuffer, opts = {}) {
  const filename = opts.filename || `upload-${Date.now()}.jpg`;
  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: 'image/jpeg',
      body: Readable.from(jpegBuffer),
    },
    fields: 'id, name, mimeType, thumbnailLink, webViewLink',
    supportsAllDrives: true,
  });
  const file = created.data;
  if (opts.publicReader) {
    try {
      await drive.permissions.create({
        fileId: file.id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch {
      /* Shared Drive / policy */
    }
  }
  return file;
}

export async function replaceStemInFolder(drive, folderId, stem, jpegBuffer, opts = {}) {
  await deleteStemInFolder(drive, folderId, stem);
  return uploadJpegToFolder(drive, folderId, jpegBuffer, {
    filename: `${stem}.jpg`,
    publicReader: opts.publicReader !== false,
  });
}

export async function setPublicReader(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch {
    /* ignore */
  }
}

export async function requireUserDrive() {
  if (!hasUserDriveToken()) {
    throw Object.assign(
      new Error('Unggah membutuhkan token Drive pemilik (GDRIVE_USER_REFRESH_TOKEN). Hubungi Tim Tech.'),
      { status: 503 },
    );
  }
  return getUserDrive();
}

export async function findWebsiteVisualFolder(drive) {
  const visual = await findNamed(drive, process.env.GDRIVE_ROOT_FOLDER_ID, WEBSITE_VISUAL_FOLDER);
  if (!visual) {
    throw Object.assign(new Error(`Folder "${WEBSITE_VISUAL_FOLDER}" tidak ditemukan di Drive.`), { status: 503 });
  }
  return visual;
}

export function isImageFile(file) {
  const mime = String(file?.mimeType || '');
  const name = String(file?.name || '').toLowerCase();
  if (mime === FOLDER_MIME) return false;
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/.test(name);
}

/** List images in folder + one level of child folders (album dumps). */
export async function listImagesRecursive(drive, folderId, { pageSize = 48, maxChildren = 24 } = {}) {
  const kids = await listFolderFiles(drive, folderId, 100);
  const images = kids.filter(isImageFile);
  const folders = kids.filter((f) => f.mimeType === FOLDER_MIME).slice(0, maxChildren);
  for (const folder of folders) {
    const nested = await listFolderFiles(drive, folder.id, pageSize);
    for (const f of nested) {
      if (isImageFile(f)) images.push(f);
    }
  }
  return images.slice(0, pageSize);
}
