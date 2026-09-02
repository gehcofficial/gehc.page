/**
 * Foto profil: Google default, kustom via Drive → CDN.
 */
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { WEBSITE_VISUAL_FOLDER } from './website-visuals.mjs';
import { getUserDrive, hasUserDriveToken } from './gdrive-user-oauth.mjs';
import { publishVisualsConfigured, triggerPublishVisualsWorkflow } from './github-actions.mjs';

export const AVATAR_SOURCE_GOOGLE = 'GOOGLE';
export const AVATAR_SOURCE_CUSTOM = 'CUSTOM';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;
const PUBLISH_DEBOUNCE_MS = 3 * 60 * 1000;

let lastUsersPublishAt = 0;

export function googleAvatarCreate(picture) {
  const pic = picture || null;
  return {
    avatar: pic,
    avatarGoogle: pic,
    avatarSource: AVATAR_SOURCE_GOOGLE,
  };
}

/** Patch fields when Google picture arrives. Never clobber CUSTOM avatars. */
export function googleAvatarPatch(existing, picture) {
  const pic = picture || null;
  const source = existing?.avatarSource || AVATAR_SOURCE_GOOGLE;
  const data = {};
  if (pic) data.avatarGoogle = pic;
  if (source !== AVATAR_SOURCE_CUSTOM) {
    if (pic) data.avatar = pic;
    data.avatarSource = AVATAR_SOURCE_GOOGLE;
  }
  return data;
}

export function avatarStem(userId) {
  return String(userId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

export function staticUserAvatarUrl(userId) {
  const stem = avatarStem(userId);
  return stem ? `/visuals/users/${stem}.jpg` : '';
}

export function thumbnailCdnUrl(file) {
  const link = file?.thumbnailLink || file?.thumbnailUrl || '';
  if (!link) return '';
  return link.replace(/=s\d+.*$/, '=s900');
}

export async function optimizeAvatarBuffer(input) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 900, height: 900, fit: 'cover', withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

export function decodeAvatarUpload({ mimetype, data }) {
  const mime = String(mimetype || '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('Format foto: JPEG, PNG, atau WebP.');
  }
  const raw = String(data || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  if (!raw) throw new Error('Data foto kosong.');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('Data foto tidak valid.');
  if (buffer.length > MAX_BYTES) throw new Error('Ukuran foto maksimal 2 MB.');
  return { buffer, mime };
}

async function listNamedFolders(drive, parentId) {
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

async function findNamed(drive, parentId, name) {
  const want = String(name).toLowerCase();
  const folders = await listNamedFolders(drive, parentId);
  return folders.find((f) => String(f.name || '').toLowerCase() === want) || null;
}

async function ensureUsersFolder(drive) {
  const visual = await findNamed(drive, process.env.GDRIVE_ROOT_FOLDER_ID, WEBSITE_VISUAL_FOLDER);
  if (!visual) {
    throw new Error(`Folder "${WEBSITE_VISUAL_FOLDER}" tidak ditemukan di Drive.`);
  }
  let users = await findNamed(drive, visual.id, 'users');
  if (!users) {
    const created = await drive.files.create({
      requestBody: {
        name: 'users',
        mimeType: FOLDER_MIME,
        parents: [visual.id],
      },
      fields: 'id, name',
      supportsAllDrives: true,
    });
    users = created.data;
  }
  return users;
}

async function listFolderFiles(drive, folderId) {
  const q = `'${folderId}' in parents and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 100,
    fields: 'files(id, name, mimeType, thumbnailLink)',
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

export async function uploadUserAvatarToDrive(userId, jpegBuffer) {
  if (!hasUserDriveToken()) {
    throw new Error('Unggah foto membutuhkan token Drive pemilik (GDRIVE_USER_REFRESH_TOKEN). Hubungi Tim Tech.');
  }
  const stem = avatarStem(userId);
  if (!stem) throw new Error('ID user tidak valid untuk nama file.');
  const drive = await getUserDrive();
  const folder = await ensureUsersFolder(drive);
  const existing = (await listFolderFiles(drive, folder.id)).filter((f) => stemOf(f.name) === stem.toLowerCase());
  for (const f of existing) {
    try {
      await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
    } catch {
      /* ignore */
    }
  }

  const created = await drive.files.create({
    requestBody: {
      name: `${stem}.jpg`,
      parents: [folder.id],
    },
    media: {
      mimeType: 'image/jpeg',
      body: Readable.from(jpegBuffer),
    },
    fields: 'id, name, mimeType, thumbnailLink, webViewLink',
    supportsAllDrives: true,
  });
  const file = created.data;
  try {
    await drive.permissions.create({
      fileId: file.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch {
    /* folder may already be public */
  }
  const driveUrl = thumbnailCdnUrl(file) || staticUserAvatarUrl(userId);
  return { fileId: file.id, driveUrl, staticUrl: staticUserAvatarUrl(userId) };
}

export async function deleteUserAvatarFromDrive(fileId) {
  if (!fileId || !hasUserDriveToken()) return;
  try {
    const drive = await getUserDrive();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch {
    /* already gone */
  }
}

export function scheduleUsersVisualsPublish() {
  if (!publishVisualsConfigured()) return { skipped: true, reason: 'not-configured' };
  const now = Date.now();
  if (now - lastUsersPublishAt < PUBLISH_DEBOUNCE_MS) {
    return { skipped: true, reason: 'debounce' };
  }
  lastUsersPublishAt = now;
  triggerPublishVisualsWorkflow({ folder: 'users', branch: 'staging' }).catch((err) => {
    console.warn('[avatar] publish visuals:', err.message);
  });
  return { skipped: false };
}
