import { describe, expect, it } from 'vitest';
import {
  LIVE_STATUSES,
  ORDER_KINDS,
  effectiveTranspose,
  normalizeLiveStateInput,
  normalizeOrderItemInput,
  normalizeSongSettingInput,
  patternSegments,
  randomAccessCode,
  readWeekPericope,
  resolveLyrics,
  serializeOrderItem,
  skeletonFromPattern,
} from '../../server/lib/liturgy-live.mjs';

const SAMPLE_SONG = {
  title: 'Kasih Setia-Mu',
  sourceRef: 'LOKAL-CONTOH-001',
  sourceUrl: null,
  lyricsChordPro: ['[Verse 1]', '[G]Kasih setia-Mu [C]tak pernah berakhir,', '', '[Chorus]', '[G]Besar setia-Mu.'].join('\n'),
};
const SAMPLE_USAGE = { sections: null, moment: 'pembuka' };

describe('liturgia-live: validasi order', () => {
  it('momen lagu boleh slot kosong (diisi nanti via kerangka)', () => {
    const d = normalizeOrderItemInput({ kind: 'lagu', title: 'Praise 1', segmentKey: '1:praise', phaseNo: 1 });
    expect(d.serviceSongId ?? null).toBeNull();
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

const MONOLOG_PATTERN = {
  code: 'MONOLOG',
  name: 'Monolog',
  phases: [
    {
      no: 1, title: 'Praise & Worship + Bedah Lagu', minutes: 20, owner: 'Liturgia',
      segments: [
        { key: 'praise', label: 'Praise', kind: 'song', songs: 3 },
        { key: 'worship', label: 'Worship', kind: 'song', songs: 2 },
        { key: 'bedah-lagu', label: 'Bedah Lagu', kind: 'song', songs: 1 },
      ],
    },
    { no: 2, title: 'Monolog', minutes: 30, segments: [{ key: 'firman', label: 'Firman', kind: 'firman', auto: true }] },
    { no: 3, title: 'Briefing', minutes: 5 },
    { no: 9, title: 'Aneh', segments: [{ key: '', kind: 'song' }, { kind: 'doa' }, null] },
  ],
};

describe('liturgia-segments: kerangka dari pola', () => {
  it('hanya segmen song/firman ber-key yang dipakai', () => {
    const segs = patternSegments(MONOLOG_PATTERN);
    expect(segs.map((s) => s.key)).toEqual(['praise', 'worship', 'bedah-lagu', 'firman']);
    expect(segs[0]).toMatchObject({ phaseNo: 1, kind: 'song', songs: 3 });
    expect(patternSegments(null)).toEqual([]);
    expect(patternSegments({ phases: 'rusak' })).toEqual([]);
  });

  it('skeleton: slot lagu kosong + firman auto + trace segmen', () => {
    const sk = skeletonFromPattern(MONOLOG_PATTERN);
    expect(sk.length).toBe(3 + 2 + 1 + 1);
    expect(sk[0]).toMatchObject({ kind: 'lagu', title: 'Praise 1', segmentKey: '1:praise', phaseNo: 1, serviceSongId: null });
    expect(sk[3]).toMatchObject({ kind: 'lagu', title: 'Worship 1', segmentKey: '1:worship' });
    expect(sk[6]).toMatchObject({ kind: 'firman', title: 'Firman', segmentKey: '2:firman' });
  });

  it('order terima slot kosong + jejak segmen', () => {
    const d = normalizeOrderItemInput({ kind: 'lagu', title: 'Praise 1', segmentKey: '1:praise', phaseNo: 1 });
    expect(d.serviceSongId ?? null).toBeNull();
    expect(d.segmentKey).toBe('1:praise');
    expect(d.phaseNo).toBe(1);
    expect(serializeOrderItem({ id: 'x', segmentKey: '1:praise', phaseNo: 1 }).segmentKey).toBe('1:praise');
  });

  it('firman: auto perikop bila body kosong, manual menang', () => {
    const peri = { ref: 'Yoh 3:16', text: 'Karena begitu besar kasih Allah...', kitabFokus: 'Yohanes' };
    const auto = resolveLyrics({ kind: 'firman', title: 'Firman' }, null, null, peri);
    expect(auto.auto).toBe(true);
    expect(auto.title).toBe('Firman');
    expect(auto.body).toContain('Yoh 3:16');
    expect(auto.body).toContain('Kitab fokus: Yohanes');
    const manual = resolveLyrics({ kind: 'firman', title: 'Firman', body: 'Teks manual.' }, null, null, peri);
    expect(manual.auto).toBe(false);
    expect(manual.body).toBe('Teks manual.');
    const empty = resolveLyrics({ kind: 'firman', title: 'Firman' }, null, null, null);
    expect(empty.auto).toBe(false);
    expect(empty.body).toBe('');
  });

  it('readWeekPericope: cocok tanggal, toleran kosong', async () => {
    const prisma = {
      ministryMonthPlan: {
        findUnique: async () => ({
          weeks: [
            { date: '2026-10-11', studio: { fundamentalFirman: { ref: 'Yoh 3:16', text: 'Teks.' }, kitabFokus: 'Yohanes' } },
            { date: '2026-10-18', studio: {} },
          ],
        }),
      },
    };
    expect(await readWeekPericope(prisma, '2026-10-11T00:00:00.000Z')).toEqual({
      ref: 'Yoh 3:16', text: 'Teks.', kitabFokus: 'Yohanes',
    });
    expect(await readWeekPericope(prisma, '2026-10-18')).toBeNull();
    expect(await readWeekPericope(prisma, 'acak')).toBeNull();
    expect(await readWeekPericope(null, '2026-10-11')).toBeNull();
  });
});
