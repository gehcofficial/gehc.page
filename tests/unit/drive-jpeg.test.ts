import { describe, expect, it } from 'vitest';
import {
  decodeImageUpload,
  toJpegBuffer,
  MAX_UPLOAD_BYTES,
} from '../../server/lib/drive-jpeg.mjs';
import {
  JEMAAT_PHOTO_RAW_MAX_BYTES,
  JEMAAT_PHOTO_RAW_MAX_BASE64,
} from '../../server/lib/gallery-jemaat.mjs';

// PNG 1x1 piksel — cukup untuk uji pipeline sharp tanpa file besar.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('decodeImageUpload — HEIC otomatis', () => {
  it('terima HEIC berdasar ekstensi walau mimetype kosong (kasus iPhone)', () => {
    const { buffer, mime } = decodeImageUpload({
      mimetype: '',
      data: TINY_PNG_BASE64,
      filename: 'IMG_1234.heic',
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(mime).toBe('image/heic');
  });

  it('terima mimetype image/heic eksplisit', () => {
    const { mime } = decodeImageUpload({
      mimetype: 'image/heic',
      data: TINY_PNG_BASE64,
      filename: 'foto.heic',
    });
    expect(mime).toBe('image/heic');
  });

  it('tolak mimetype non-gambar', () => {
    expect(() =>
      decodeImageUpload({ mimetype: 'application/pdf', data: TINY_PNG_BASE64, filename: 'doc.pdf' }),
    ).toThrow(/Format foto/);
  });

  it('kupas prefix data-url sebelum decode', () => {
    const { buffer } = decodeImageUpload({
      mimetype: 'image/png',
      data: `data:image/png;base64,${TINY_PNG_BASE64}`,
      filename: 'a.png',
    });
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('batas default 8MB, override jemaat 15MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
    expect(JEMAAT_PHOTO_RAW_MAX_BYTES).toBe(15 * 1024 * 1024);
    expect(JEMAAT_PHOTO_RAW_MAX_BASE64).toBeGreaterThan(15_000_000);
    // Buffer 9MB: gagal di default, lolos dengan override jemaat.
    const big = Buffer.alloc(9 * 1024 * 1024, 1).toString('base64');
    expect(() =>
      decodeImageUpload({ mimetype: 'image/jpeg', data: big, filename: 'besar.jpg' }),
    ).toThrow(/maksimal 8 MB/);
    expect(() =>
      decodeImageUpload(
        { mimetype: 'image/jpeg', data: big, filename: 'besar.jpg' },
        { maxBytes: JEMAAT_PHOTO_RAW_MAX_BYTES },
      ),
    ).not.toThrow();
  });
});

describe('toJpegBuffer — kompres otomatis', () => {
  it('PNG kecil → JPEG valid (magic bytes FF D8)', async () => {
    const input = Buffer.from(TINY_PNG_BASE64, 'base64');
    const out = await toJpegBuffer(input, { maxWidth: 1600 });
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
  });
});
