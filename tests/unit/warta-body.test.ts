import { describe, it, expect } from 'vitest';
import { wartaBodyFromContent } from '../../server/lib/content-map.mjs';

describe('wartaBodyFromContent', () => {
  it('menyusun body dari field terstruktur', () => {
    const body = wartaBodyFromContent({ khotbah: 'Hidup kudus', pengumuman: 'Retreat', doa: '' }, 'Judul');
    expect(body).toContain('Khotbah:\nHidup kudus');
    expect(body).toContain('Pengumuman:\nRetreat');
    expect(body).not.toContain('Doa:');
  });

  it('memakai body langsung bila sudah ada', () => {
    expect(wartaBodyFromContent({ body: 'Siap tayang' }, 'Judul')).toBe('Siap tayang');
  });

  it('fallback ke judul bila semua kosong', () => {
    expect(wartaBodyFromContent({}, 'Judul Warta')).toBe('Judul Warta');
    expect(wartaBodyFromContent(null, 'Judul Warta')).toBe('Judul Warta');
  });

  it('string contentJson lama tetap dipakai', () => {
    expect(wartaBodyFromContent('teks lama', 'Judul')).toBe('teks lama');
  });
});
