import { describe, expect, it } from 'vitest';
import {
  LIVE_STATUSES,
  ORDER_KINDS,
  effectiveTranspose,
  normalizeLiveStateInput,
  normalizeOrderItemInput,
  normalizeSongSettingInput,
  randomAccessCode,
  resolveLyrics,
} from '../../server/lib/liturgy-live.mjs';

const SAMPLE_SONG = {
  title: 'Kasih Setia-Mu',
  sourceRef: 'LOKAL-CONTOH-001',
  sourceUrl: null,
  lyricsChordPro: ['[Verse 1]', '[G]Kasih setia-Mu [C]tak pernah berakhir,', '', '[Chorus]', '[G]Besar setia-Mu.'].join('\n'),
};
const SAMPLE_USAGE = { sections: null, moment: 'pembuka' };

describe('liturgia-live: validasi order', () => {
  it('momen lagu wajib menunjuk lagu setlist', () => {
    expect(() => normalizeOrderItemInput({ kind: 'lagu' })).toThrow('menunjuk lagu setlist');
    const ok = normalizeOrderItemInput({ kind: 'lagu', serviceSongId: 'ssvc-1', title: 'X' });
    expect(ok.serviceSongId).toBe('ssvc-1');
  });

  it('momen non-lagu boleh tanpa lagu, bawa teks sendiri', () => {
    const d = normalizeOrderItemInput({ kind: 'firman', title: 'Bacaan', body: 'Yoh 3:16', owner: 'Pdt.', minutes: 10 });
    expect(d.kind).toBe('firman');
    expect(d.body).toBe('Yoh 3:16');
    expect(d.minutes).toBe(10);
  });

  it('jenis & durasi divalidasi', () => {
    expect(() => normalizeOrderItemInput({ kind: 'solo' })).toThrow('Jenis momen');
    expect(() => normalizeOrderItemInput({ kind: 'doa', minutes: 999 })).toThrow('Durasi');
  });

  it('kinds & status terdokumentasi', () => {
    expect(ORDER_KINDS).toEqual(['lagu', 'bacaan', 'doa', 'firman', 'persembahan', 'pengumuman', 'mc']);
    expect(LIVE_STATUSES).toEqual(['DRAFT', 'LIVE', 'DONE']);
  });
});

describe('liturgia-live: live state', () => {
  it('status & sectionIndex divalidasi + dijepit', () => {
    expect(normalizeLiveStateInput({ status: 'live' }).status).toBe('LIVE');
    expect(normalizeLiveStateInput({ sectionIndex: 99 }).sectionIndex).toBe(99);
    expect(normalizeLiveStateInput({ sectionIndex: 999 }).sectionIndex).toBe(200);
    expect(normalizeLiveStateInput({ sectionIndex: -5 }).sectionIndex).toBe(0);
    expect(() => normalizeLiveStateInput({ status: 'ulang' })).toThrow('Status');
  });

  it('kode proyektor 6 karakter tanpa ambigu', () => {
    for (let i = 0; i < 20; i += 1) {
      const c = randomAccessCode();
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
      expect(c).not.toMatch(/[01IO]/);
    }
    const set = new Set(Array.from({ length: 30 }, () => randomAccessCode()));
    expect(set.size).toBeGreaterThan(25);
  });
});

describe('liturgia-live: transpose personal', () => {
  it('clamp ±11 & capo 0..11', () => {
    expect(normalizeSongSettingInput({ transpose: 99, capo: 99 })).toEqual({ transpose: 11, capo: 11 });
    expect(normalizeSongSettingInput({ transpose: -99, capo: '' })).toEqual({ transpose: -11, capo: null });
    expect(normalizeSongSettingInput({})).toEqual({ transpose: 0, capo: null });
  });

  it('setting personal menang, fallback default item', () => {
    expect(effectiveTranspose({ transpose: 2, capo: 1 }, null)).toEqual({ transpose: 2, capo: 1 });
    expect(effectiveTranspose({ transpose: 2, capo: 1 }, { transpose: -1, capo: null })).toEqual({ transpose: -1, capo: 1 });
    expect(effectiveTranspose(null, null)).toEqual({ transpose: 0, capo: null });
    expect(effectiveTranspose({ transpose: 0 }, { transpose: 3, capo: 2 })).toEqual({ transpose: 3, capo: 2 });
  });
});

describe('liturgia-live: resolveLyrics untuk layar', () => {
  it('momen teks teruskan judul + isi', () => {
    const r = resolveLyrics({ kind: 'firman', title: 'Bacaan Alkitab', body: 'Yohanes 3:16', owner: 'Pembaca' });
    expect(r.kind).toBe('text');
    expect(r.body).toBe('Yohanes 3:16');
    expect(r.title).toBe('Bacaan Alkitab');
  });

  it('lagu ber-chord jadi bait lirik bersih (tanpa chord, tanpa transpose)', () => {
    const r = resolveLyrics({ kind: 'lagu' }, SAMPLE_SONG, SAMPLE_USAGE);
    expect(r.kind).toBe('song');
    expect(r.hasLyrics).toBe(true);
    expect(r.sections?.map((s) => s.name)).toEqual(['Verse 1', 'Chorus']);
    expect(r.sections?.[0].lines[0]).toBe('Kasih setia-Mu tak pernah berakhir,');
    expect(r.sections?.[0].lines[0]).not.toContain('[G]');
  });

  it('lagu tanpa lirik: hasLyrics false + bawa sourceUrl', () => {
    const r = resolveLyrics(
      { kind: 'lagu' },
      { title: 'KJ X', sourceRef: 'KJ 999', sourceUrl: 'https://alkitab.app/x', lyricsChordPro: null },
      { sections: null },
    );
    expect(r.hasLyrics).toBe(false);
    expect(r.sourceUrl).toBe('https://alkitab.app/x');
  });

  it('sections terpilih membatasi bait layar', () => {
    const r = resolveLyrics({ kind: 'lagu' }, SAMPLE_SONG, { sections: ['Chorus'], moment: 'penutup' });
    expect(r.sections?.map((s) => s.name)).toEqual(['Chorus']);
  });
});
