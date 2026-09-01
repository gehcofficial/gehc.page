/**
 * Optimasi file yang sudah ada di public/visuals/ + perbarui manifest.
 *   npm run visuals:optimize
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VISUAL_SLOTS } from './lib/website-visuals.mjs';
import {
  VISUALS_DIR,
  MANIFEST_PATH,
  emptySlots,
  assignSlot,
  slotsHasAny,
  staticUrl,
  localPath,
  writeManifest,
  loadStaticSlots,
} from './lib/static-visuals.mjs';
import { optimizeImageFile, formatSize, profileForPath } from './lib/visual-optimize.mjs';

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

function walkImages(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const full = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkImages(full, rel));
    else if (IMAGE_RE.test(name.name) && name.name !== 'manifest.json') out.push(rel);
  }
  return out;
}

function slotKeyForRel(rel) {
  const lower = rel.toLowerCase();
  for (const slot of VISUAL_SLOTS) {
    const stem = `${slot.folder}/${slot.stem}`.toLowerCase();
    if (lower === stem || lower.startsWith(`${stem}.`)) return slot.key;
  }
  return '';
}

async function main() {
  if (!existsSync(VISUALS_DIR)) {
    console.error(`Folder tidak ada: ${VISUALS_DIR}`);
    process.exit(1);
  }

  const images = walkImages(VISUALS_DIR);
  console.log(`Optimasi ${images.length} file di ${VISUALS_DIR}\n`);

  let saved = 0;
  for (const rel of images.sort()) {
    const abs = localPath(rel);
    const key = slotKeyForRel(rel);
    const profile = profileForPath(rel, key);
    try {
      const { bytes, before } = await optimizeImageFile(abs, rel, key);
      saved += before - bytes;
      console.log(
        `  ✓ ${rel}  ${formatSize(before)} → ${formatSize(bytes)}  (max ${profile.maxWidth}px q${profile.quality})`
      );
    } catch (e) {
      console.error(`  ! ${rel}: ${e.message}`);
    }
  }

  const prev = loadStaticSlots();
  const slots = emptySlots();

  for (const rel of walkImages(VISUALS_DIR)) {
    const mtime = statSync(localPath(rel)).mtimeMs;
    const key = slotKeyForRel(rel);
    if (key) {
      assignSlot(slots, key, staticUrl(rel, mtime));
      continue;
    }
    const folder = rel.split('/')[0];
    const stem = rel.replace(/\.[^.]+$/, '').split('/').pop()?.toLowerCase();
    if ((folder === 'pengurus' || folder === 'testimoni') && stem) {
      if (!slots[folder]) slots[folder] = {};
      slots[folder][stem] = staticUrl(rel, mtime);
    }
  }

  if (!slotsHasAny(slots)) {
    console.error('Manifest kosong setelah optimasi.');
    process.exit(1);
  }

  writeManifest({
    slots,
    rootFolderId: prev ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).rootFolderId : null,
  });
  console.log(`\nSelesai — hemat ~${formatSize(Math.max(0, saved))} total.`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
