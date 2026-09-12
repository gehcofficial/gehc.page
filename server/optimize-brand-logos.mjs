/**
 * Optimasi logo brand di Drive (timpa in-place): resize tinggi ≤480px, PNG.
 * Memakai token OAuth pemilik (`.gdrive-user-token.json` / GDRIVE_USER_REFRESH_TOKEN).
 *
 * Jalankan:
 *   npm run drive:optimize-logos          (staging, .env)
 *   npm run drive:optimize-logos:prod     (.env.production)
 */
import 'dotenv/config';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { getUserDrive } from './lib/gdrive-user-oauth.mjs';
import { findNamed, listFolderFiles } from './lib/drive-folders.mjs';
import { WEBSITE_VISUAL_FOLDER } from './lib/website-visuals.mjs';

const STEMS = ['logo-youth-gmim', 'logo-gmim'];
const MAX_HEIGHT = 480;

const stemOf = (name) => String(name || '').replace(/\.[^.]+$/, '').toLowerCase();

(async () => {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set.');
  const drive = await getUserDrive();

  const visual = await findNamed(drive, rootId, WEBSITE_VISUAL_FOLDER);
  if (!visual) throw new Error(`Folder "${WEBSITE_VISUAL_FOLDER}" tidak ditemukan.`);
  const brand = await findNamed(drive, visual.id, 'brand');
  if (!brand) throw new Error('Subfolder "brand" tidak ditemukan.');

  const files = await listFolderFiles(drive, brand.id, 100);
  console.log('Optimasi logo brand…');

  for (const target of STEMS) {
    const file = files.find((f) => stemOf(f.name) === target);
    if (!file) {
      console.log(`  - ${target}: tidak ada (dilewati)`);
      continue;
    }
    const dl = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
    const input = Buffer.from(dl.data);
    const out = await sharp(input)
      .resize({ height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (out.length >= input.length) {
      console.log(`  - ${target}: sudah optimal (${input.length} B)`);
      continue;
    }
    await drive.files.update({
      fileId: file.id,
      media: { mimeType: 'image/png', body: Readable.from(out) },
      fields: 'id, name, size',
      supportsAllDrives: true,
    });
    console.log(`  ✓ ${target}: ${input.length} → ${out.length} B`);
  }
  console.log('✓ Selesai');
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
