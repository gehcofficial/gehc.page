/**
 * Auto-provision event folders under pillar Drive folders.
 * Name: `<Event> [EV:<slug>:<DIV>]` plus division subfolders.
 */
import { listFolders, createFolder } from './gdrive.mjs';

const PILLAR_MATCH = {
  LITURGIA: /^liturgia/i,
  DIDASKALIA: /^didaskalia/i,
  KOINONIA: /^koinonia/i,
  DIAKONIA: /^diakonia/i,
  MARTURIA: /^marturia/i,
  BENZARPR: /benzar/i,
};

const CHILD_FOLDERS = {
  LITURGIA: ['Rundown ibadah', 'Rehearsal'],
  DIDASKALIA: ['Materi'],
  KOINONIA: ['Check-in', 'Welcome', 'Rundown'],
  DIAKONIA: ['Logistik', 'Konsumsi'],
  MARTURIA: ['Dokumentasi', 'Desain'],
  BENZARPR: ['Kasir'],
};

function eventFolderName(event, division) {
  return `${event.name} [EV:${event.slug}:${division}]`;
}

async function findNamed(parentId, matcher) {
  const folders = await listFolders(parentId, 100);
  return folders.find((f) => matcher.test(f.name)) || null;
}

async function ensureChild(parentId, name) {
  const existing = await findNamed(parentId, new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
  if (existing) return existing.id;
  const created = await createFolder(parentId, name);
  return created?.id || null;
}

export async function createEventFolder(event, division) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum diisi.');
  const match = PILLAR_MATCH[division];
  if (!match) throw new Error(`Divisi Drive tidak dikenal: ${division}`);

  const pillar = await findNamed(rootId, match);
  if (!pillar) throw new Error(`Folder pillar ${division} tidak ditemukan di Drive.`);

  const wantName = eventFolderName(event, division);
  let eventFolder = await findNamed(pillar.id, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
  if (!eventFolder) {
    const created = await createFolder(pillar.id, wantName);
    eventFolder = { id: created.id, name: created.name };
  }

  const kids = CHILD_FOLDERS[division] || [];
  for (const child of kids) {
    await ensureChild(eventFolder.id, child);
  }
  return eventFolder.id;
}
