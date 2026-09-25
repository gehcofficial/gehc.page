/**
 * Siapkan folder Drive lampiran "Info & Peluang [PRIVAT]" dan simpan id-nya ke DB
 * (ChannelLink kind INTERNAL_WARTA) agar app tak bergantung GDRIVE_ROOT_FOLDER_ID saat runtime.
 *
 *   npm run db:setup:internal-warta-folder[:staging|:prod]
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';
import { getDriveMode, listFolders, createFolder } from '../server/gdrive.mjs';

const FOLDER_NAME = 'Info & Peluang [PRIVAT]';

const prisma = getPrisma();
if (!prisma) { console.error('DB belum dikonfigurasi.'); process.exit(1); }
console.log(`Setup folder lampiran → ${getDbLabel()} | mode ${getDriveMode()}`);

const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
if (!rootId) { console.error('GDRIVE_ROOT_FOLDER_ID kosong di env ini.'); process.exit(1); }

const subs = await listFolders(rootId, 100).catch(() => []);
let folder = subs.find((f) => String(f.name) === FOLDER_NAME);
if (folder) {
  console.log('Folder sudah ada:', folder.id);
} else {
  const created = await createFolder(rootId, FOLDER_NAME);
  folder = { id: created.id };
  console.log('Folder dibuat:', folder.id);
}

await prisma.channelLink.upsert({
  where: { kind_refId: { kind: 'INTERNAL_WARTA', refId: 'FOLDER' } },
  update: { url: folder.id, label: FOLDER_NAME },
  create: { id: 'cl-internal-warta-folder', kind: 'INTERNAL_WARTA', refId: 'FOLDER', label: FOLDER_NAME, url: folder.id },
});
console.log('✓ Tersimpan di DB (ChannelLink INTERNAL_WARTA/FOLDER).');

await prisma.$disconnect();
