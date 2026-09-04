/**
 * Dual-write stem publik Website Visual + arsip opsional ke folder zona.
 */
import { publishVisualsConfigured, triggerPublishVisualsWorkflow } from './github-actions.mjs';
import {
  requireUserDrive,
  findWebsiteVisualFolder,
  ensureNamedFolder,
  replaceStemInFolder,
  uploadJpegToFolder,
  driveThumbUrl,
} from './drive-folders.mjs';
import { findRegisteredSlot } from './drive-ownership.mjs';

const lastPublish = new Map();
const PUBLISH_DEBOUNCE_MS = 20_000;

export function scheduleVisualsPublish(folder) {
  if (!publishVisualsConfigured()) return { skipped: true, reason: 'not-configured' };
  const key = String(folder || '');
  const now = Date.now();
  if (now - (lastPublish.get(key) || 0) < PUBLISH_DEBOUNCE_MS) {
    return { skipped: true, reason: 'debounce' };
  }
  lastPublish.set(key, now);
  triggerPublishVisualsWorkflow({ folder: key, branch: 'staging' }).catch((err) => {
    console.warn('[visual-slot] publish:', err.message);
  });
  return { skipped: false };
}

export async function replaceVisualStem({ folder, stem, jpegBuffer, publish = true }) {
  const slot = findRegisteredSlot(folder, stem);
  if (!slot) {
    throw Object.assign(new Error('Slot tidak terdaftar.'), { status: 400 });
  }
  const drive = await requireUserDrive();
  const visual = await findWebsiteVisualFolder(drive);
  const dest = await ensureNamedFolder(drive, visual.id, slot.folder);
  const file = await replaceStemInFolder(drive, dest.id, slot.stem, jpegBuffer, { publicReader: true });
  if (publish) scheduleVisualsPublish(slot.folder);
  return {
    fileId: file.id,
    name: file.name,
    webViewLink: file.webViewLink,
    thumbnailUrl: driveThumbUrl(file.id),
    folder: slot.folder,
    stem: slot.stem,
    key: slot.key,
  };
}

export async function backupToOpsFolder({ folderId, jpegBuffer, filename }) {
  if (!folderId) return null;
  const drive = await requireUserDrive();
  const file = await uploadJpegToFolder(drive, folderId, jpegBuffer, {
    filename: filename || `arsip-${Date.now()}.jpg`,
    publicReader: false,
  });
  return { fileId: file.id, name: file.name, webViewLink: file.webViewLink };
}
