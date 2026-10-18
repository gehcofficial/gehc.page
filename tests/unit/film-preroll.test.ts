import { describe, expect, it } from 'vitest';
import { buildFilmPreRoll, PRE_ROLL_MAX_CUSTOM, PRE_ROLL_MAX_CUSTOM_CHARS } from '../../src/lib/film-preroll';

describe('buildFilmPreRoll: deck pre-roll bioskop BEDAH_FILM', () => {
  it('urutan default: pembuka → sensor → film → tenang → hp → konsumsi → penutup tiket', () => {
    const slides = buildFilmPreRoll({ title: 'The Case for Christ (2017)', durationMin: 112 });
    expect(slides.map((s) => s.id)).toEqual([
      'pembuka',
      'sensor',
      'film',
      'tenang',
      'hp',
      'konsumsi',
      'tanpa-jeda',
      'tidur',
      'refleksi',
      'tiket',
    ]);
    const film = slides.find((s) => s.id === 'film');
    expect(film?.headline).toBe('The Case for Christ (2017)');
    expect(film?.sub).toContain('112 menit');
    expect(slides.find((s) => s.id === 'sensor')?.variant).toBe('stamp');
    expect(slides.find((s) => s.id === 'pembuka')?.kicker).toBe('Youth GEHC mempersembahkan');
  });

  it('tanpa judul → tanpa slide film; durasi 0 → sub tanpa angka', () => {
    const noTitle = buildFilmPreRoll({ title: '  ' });
    expect(noTitle.some((s) => s.id === 'film')).toBe(false);
    const noDuration = buildFilmPreRoll({ title: 'Gavin Stone', durationMin: 0 });
    expect(noDuration.find((s) => s.id === 'film')?.sub).toBe('Tanpa jeda, tanpa iklan.');
  });

  it('pengumuman tambahan: trim, buang kosong, maks 6, disisipkan setelah konsumsi', () => {
    const custom = ['Tuan rumah membagikan konsumsi', ' ', '   ', ...Array.from({ length: 8 }, (_, i) => `Info ${i + 1}`)];
    const slides = buildFilmPreRoll({ title: 'A', customLines: custom });
    const ids = slides.map((s) => s.id);
    expect(ids.filter((id) => id.startsWith('custom-'))).toHaveLength(PRE_ROLL_MAX_CUSTOM);
    expect(ids.indexOf('custom-0')).toBe(ids.indexOf('konsumsi') + 1);
    expect(ids.indexOf(`custom-${PRE_ROLL_MAX_CUSTOM - 1}`)).toBeLessThan(ids.indexOf('tanpa-jeda'));
    const first = slides.find((s) => s.id === 'custom-0');
    expect(first?.headline).toBe('Tuan rumah membagikan konsumsi');
    expect(first?.icon).toBe('megaphone');
    expect(first?.kicker).toBe('Info dari tuan rumah');
  });

  it('baris custom dipotong 140 huruf; customLines null aman', () => {
    const slides = buildFilmPreRoll({ title: 'A', customLines: ['y'.repeat(300)] });
    expect(slides.find((s) => s.id === 'custom-0')?.headline).toHaveLength(PRE_ROLL_MAX_CUSTOM_CHARS);
    expect(buildFilmPreRoll({ title: 'A', customLines: null }).some((s) => s.id.startsWith('custom-'))).toBe(false);
  });
});
