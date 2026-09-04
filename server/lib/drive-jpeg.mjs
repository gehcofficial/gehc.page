/**
 * Satu primitive kompres gambar: HEIC/WebP/PNG → JPEG.
 * Dipakai cover, album, bukti TF, kesaksian, slot visual.
 */
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_JPEG_BYTES = 900 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
]);

export function decodeImageUpload({ mimetype, data, filename } = {}) {
  const mime = String(mimetype || '').toLowerCase().split(';')[0].trim();
  const name = String(filename || '').toLowerCase();
  const looksHeic = /\.(heic|heif)$/.test(name);
  if (mime && !ALLOWED_MIME.has(mime) && !looksHeic) {
    throw new Error('Format foto: JPEG, PNG, WebP, atau HEIC.');
  }
  const raw = String(data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (!raw) throw new Error('Data foto kosong.');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('Data foto tidak valid.');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Ukuran foto maksimal 8 MB.');
  return { buffer, mime: mime || (looksHeic ? 'image/heic' : 'image/jpeg') };
}

async function renderJpeg(input, { width, height, quality, fit }) {
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  if (width || height) {
    pipeline = pipeline.resize({
      width: width || undefined,
      height: height || undefined,
      fit: fit || 'inside',
      withoutEnlargement: true,
    });
  }
  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
}

/**
 * @param {Buffer} input
 * @param {{ maxWidth?: number, square?: boolean, quality?: number }} [opts]
 */
export async function toJpegBuffer(input, opts = {}) {
  const maxWidth = opts.maxWidth || 1600;
  const square = Boolean(opts.square);
  let quality = opts.quality || 82;
  let width = maxWidth;
  const fit = square ? 'cover' : 'inside';
  const height = square ? width : undefined;
  let buffer = await renderJpeg(input, { width, height, quality, fit });
  for (let i = 0; i < 8 && buffer.length > MAX_JPEG_BYTES; i++) {
    if (quality > 55) quality -= 9;
    else width = Math.max(480, Math.floor(width * 0.75));
    buffer = await renderJpeg(input, {
      width,
      height: square ? width : undefined,
      quality,
      fit,
    });
  }
  return buffer;
}
