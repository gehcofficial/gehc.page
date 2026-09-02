/**
 * Kompresi web-friendly — kualitas tinggi, ukuran wajar untuk CDN.
 * Cover kelompok ~1400px / q86 ≈ 150–400 KB (cukup tajam di carousel retina).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

/** @param {string} relPath e.g. kelompok/cover-agape.jpg */
export function profileForPath(relPath, slotKey = '') {
  const folder = String(relPath || '').split('/')[0] || '';
  const base = relPath.toLowerCase();

  if (folder === 'brand' || base.endsWith('qris.png')) {
    return { maxWidth: 640, png: true, quality: 92 };
  }
  if (folder === 'landing') {
    if (base.includes('01-hero')) return { maxWidth: 2000, quality: 88 };
    return { maxWidth: 1200, quality: 86 };
  }
  if (folder === 'kelompok') return { maxWidth: 1400, quality: 86 };
  if (folder === 'pengurus' || folder === 'users') return { maxWidth: 900, quality: 86 };
  if (folder === 'testimoni') return { maxWidth: 700, quality: 85 };
  if (folder === 'benzarpreneurship') return { maxWidth: 1600, quality: 86 };
  if (slotKey === 'warta.bannerDefault') return { maxWidth: 1400, quality: 86 };
  return { maxWidth: 1600, quality: 86 };
}

/**
 * @returns {{ bytes: number, before: number, relOut: string }}
 */
export async function optimizeImageFile(absPath, relPath, slotKey = '') {
  const before = readFileSync(absPath);
  const profile = profileForPath(relPath, slotKey);
  const meta = await sharp(before, { failOn: 'none' }).metadata();

  let pipeline = sharp(before, { failOn: 'none' }).rotate();
  if (profile.maxWidth && (meta.width || 0) > profile.maxWidth) {
    pipeline = pipeline.resize({
      width: profile.maxWidth,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  let out;
  if (profile.png) {
    out = await pipeline.png({ quality: profile.quality, compressionLevel: 9, effort: 10 }).toBuffer();
  } else {
    out = await pipeline.jpeg({ quality: profile.quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  }

  writeFileSync(absPath, out);
  const relOut = relPath.replace(/\.(png|jpe?g|webp)$/i, profile.png ? '.png' : '.jpg');
  return { bytes: out.length, before: before.length, relOut };
}

export function formatSize(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
