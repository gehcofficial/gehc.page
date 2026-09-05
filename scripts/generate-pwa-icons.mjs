/**
 * Rasterize public/visuals/brand/logo-gehc.png into PWA PNG sizes.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public/visuals/brand/logo-gehc.png');
const outDir = path.join(root, 'public/icons');
const BG = { r: 17, g: 17, b: 17, alpha: 1 };

const ANY_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

async function iconAny(size) {
  return sharp(src)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
}

async function iconMaskable(size) {
  const inner = Math.round(size * 0.72);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, `icon-maskable-${size}.png`));
}

await mkdir(outDir, { recursive: true });
await Promise.all(ANY_SIZES.map((s) => iconAny(s)));
await Promise.all(MASKABLE_SIZES.map((s) => iconMaskable(s)));

const apple = await sharp(path.join(outDir, 'icon-180.png')).png().toBuffer();
await writeFile(path.join(outDir, 'apple-touch-icon.png'), apple);

console.log('Wrote PWA icons to public/icons/');
