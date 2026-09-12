/**
 * Galeri hub gehc.page — kelola foto di `Website Visual [PUBLIK]/hub/`.
 * Baca via service account (publik), tulis via token OAuth pemilik.
 */
import { requireRole } from '../auth.mjs';
import { getDriveMode, listFolders, listFiles } from '../gdrive.mjs';
import { decodeImageUpload, toJpegBuffer } from '../lib/drive-jpeg.mjs';
import {
  requireUserDrive,
  ensureNamedFolder,
  findNamed,
  uploadJpegToFolder,
  driveThumbUrl,
  driveViewUrl,
  isImageFile,
} from '../lib/drive-folders.mjs';
import { WEBSITE_VISUAL_FOLDER } from '../lib/website-visuals.mjs';
import { bustSlotsCache } from './content-public.mjs';

const HUB_FOLDER = 'hub';
const GALLERY_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI'];
const MAX_ITEMS = 100;

function cleanName(filename, fallback) {
  const base = String(filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 60);
  return base || fallback;
}

function toItem(f) {
  return {
    id: f.id,
    name: f.name,
    thumbnailUrl: driveThumbUrl(f.id, 600),
    viewUrl: driveViewUrl(f.id),
    modifiedTime: f.modifiedTime || null,
  };
}

/** Service account: resolve folder hub untuk baca. */
async function findHubFolderRead() {
  const visual = (await listFolders(undefined, 100)).find(
    (f) => String(f.name || '').toLowerCase() === WEBSITE_VISUAL_FOLDER.toLowerCase(),
  );
  if (!visual) return null;
  return (
    (await listFolders(visual.id, 100)).find(
      (f) => String(f.name || '').toLowerCase() === HUB_FOLDER,
    ) || null
  );
}

/** OAuth pemilik: resolve folder hub untuk tulis (buat bila belum ada). */
async function resolveHubFolderWrite(drive) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const visual = await findNamed(drive, rootId, WEBSITE_VISUAL_FOLDER);
  const visualFolder = visual || (await ensureNamedFolder(drive, rootId, WEBSITE_VISUAL_FOLDER));
  const hub = await findNamed(drive, visualFolder.id, HUB_FOLDER);
  return hub || (await ensureNamedFolder(drive, visualFolder.id, HUB_FOLDER));
}

export function registerHubGalleryRoutes(app, { wrap }) {
  app.get(
    '/api/hub/gallery',
    requireRole(...GALLERY_ROLES),
    wrap(async (_req, res) => {
      if (!getDriveMode()) return res.json({ files: [], folderId: null });
      const hub = await findHubFolderRead();
      if (!hub) return res.json({ files: [], folderId: null });
      const files = await listFiles({ folderId: hub.id, pageSize: MAX_ITEMS, fresh: true });
      const images = (files || [])
        .filter((f) => isImageFile(f))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      res.json({ files: images.map(toItem), folderId: hub.id, viewUrl: driveViewUrl(hub.id) });
    }),
  );

  app.post(
    '/api/hub/gallery/ensure-folder',
    requireRole(...GALLERY_ROLES),
    wrap(async (_req, res) => {
      const drive = await requireUserDrive();
      const hub = await resolveHubFolderWrite(drive);
      bustSlotsCache();
      res.json({ ok: true, folderId: hub.id, viewUrl: driveViewUrl(hub.id) });
    }),
  );

  app.post(
    '/api/hub/gallery',
    requireRole(...GALLERY_ROLES),
    wrap(async (req, res) => {
      const drive = await requireUserDrive();
      const hub = await resolveHubFolderWrite(drive);
      const decoded = decodeImageUpload(req.body || {});
      const jpeg = await toJpegBuffer(decoded.buffer, { maxWidth: 1600 });
      const filename = `${cleanName(req.body?.filename, `jemaat-${Date.now()}`)}.jpg`;
      const file = await uploadJpegToFolder(drive, hub.id, jpeg, { filename, publicReader: true });
      bustSlotsCache();
      res.json({ ok: true, file: toItem(file) });
    }),
  );

  app.delete(
    '/api/hub/gallery/:fileId',
    requireRole(...GALLERY_ROLES),
    wrap(async (req, res) => {
      const fileId = String(req.params.fileId || '').trim();
      if (!fileId) return res.status(400).json({ error: 'fileId wajib.' });
      const drive = await requireUserDrive();
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
      bustSlotsCache();
      res.json({ ok: true });
    }),
  );
}
