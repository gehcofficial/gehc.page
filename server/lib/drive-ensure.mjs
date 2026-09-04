/**
 * Provision folder saat entitas lahir (idempotent). Pakai OAuth pemilik.
 */
import {
  requireUserDrive,
  ensureNamedFolder,
  ensureFolderPath,
  archiveFolderName,
} from './drive-folders.mjs';
import {
  GROUP_SUBFOLDERS,
  PILLAR_DRIVE_LABEL,
  PILLAR_OPS_FOLDERS,
  BZP_CATEGORY_FOLDER,
  BZP_OPS_EXTRA,
} from './drive-ownership.mjs';

export async function ensureGroupTree(groupName) {
  const drive = await requireUserDrive();
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  const mentoring = await ensureNamedFolder(drive, root, 'Kelompok Mentoring [MENTOR]');
  const tag = String(groupName || '').toUpperCase();
  const group = await ensureNamedFolder(drive, mentoring.id, `${groupName} [GROUP:${tag}]`);
  const folders = {};
  for (const sub of GROUP_SUBFOLDERS) {
    folders[sub] = await ensureNamedFolder(drive, group.id, sub);
  }
  return { drive, group, folders };
}

export async function ensurePillarTree(division) {
  const drive = await requireUserDrive();
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  const label = PILLAR_DRIVE_LABEL[String(division || '').toUpperCase()] || division;
  const pillar = await ensureNamedFolder(drive, root, `${label} [MENTOR]`);
  const folders = {};
  for (const sub of PILLAR_OPS_FOLDERS) {
    folders[sub] = await ensureNamedFolder(drive, pillar.id, sub);
  }
  return { drive, pillar, folders };
}

export async function ensureBzpProductFolder(category, productId) {
  const drive = await requireUserDrive();
  const { pillar } = await ensurePillarTree('BENZARPR');
  const catName = BZP_CATEGORY_FOLDER[String(category || '').toUpperCase()] || BZP_CATEGORY_FOLDER.MERCHANDISE;
  const cat = await ensureNamedFolder(drive, pillar.id, catName);
  const produk = await ensureNamedFolder(drive, cat.id, 'produk');
  const dest = await ensureNamedFolder(drive, produk.id, String(productId));
  return { drive, folder: dest };
}

export async function ensureBzpOrderFolder(orderCode) {
  const drive = await requireUserDrive();
  const { pillar } = await ensurePillarTree('BENZARPR');
  const pesanan = await ensureNamedFolder(drive, pillar.id, 'Pesanan');
  const dest = await ensureNamedFolder(drive, pesanan.id, String(orderCode));
  return { drive, folder: dest };
}

export async function ensureTestimonialInbox(userId) {
  const drive = await requireUserDrive();
  const { pillar } = await ensurePillarTree('MARTURIA');
  const story = await ensureNamedFolder(drive, pillar.id, 'Kesaksian & Story');
  const inbox = await ensureNamedFolder(drive, story.id, '_inbox');
  const dest = await ensureNamedFolder(drive, inbox.id, String(userId));
  return { drive, folder: dest };
}

export async function ensureEventArchiveFolder(occurredOn, title) {
  const drive = await requireUserDrive();
  const { pillar } = await ensurePillarTree('MARTURIA');
  const docs = await ensureNamedFolder(drive, pillar.id, 'Dokumentasi Visual');
  const arsip = await ensureNamedFolder(drive, docs.id, 'Arsip Acara');
  const dest = await ensureNamedFolder(drive, arsip.id, archiveFolderName(occurredOn, title));
  return { drive, folder: dest };
}

export async function ensureCareVisitFolder(subjectName, occurredOn) {
  const drive = await requireUserDrive();
  const { pillar } = await ensurePillarTree('DIAKONIA');
  const care = await ensureNamedFolder(drive, pillar.id, 'Kasih Peduli & Benevolence');
  const kunjungan = await ensureNamedFolder(drive, care.id, 'Kunjungan');
  const day = String(occurredOn || new Date().toISOString()).slice(0, 10);
  const folderName = `${day} ${String(subjectName || 'jemaat').slice(0, 60)}`.trim();
  const visit = await ensureNamedFolder(drive, kunjungan.id, folderName);
  const foto = await ensureNamedFolder(drive, visit.id, 'Foto');
  return { drive, folder: foto, visit };
}

export { ensureFolderPath };
