import { describe, expect, it } from 'vitest';
import { patternBlock } from '../../server/lib/didaskalia-ai.mjs';
import {
  divisionLabel,
  formatRangeAbs,
  formatRangeRel,
  isMainTrack,
  moduleLabel,
  OFFERING_PENUH_DELTA_MIN,
  patternCongregationMinutes,
  patternDurationDelta,
  patternParallelCheck,
  patternPreMinutes,
  patternTemplateCheck,
  patternTimeline,
  patternTotalMinutes,
  patternVariantText,
  prettyPlaybook,
  sanitizePatternVariant,
  type WorshipPatternLite,
} from '../../src/lib/worship-patterns';

const FULL: WorshipPatternLite = {
  code: 'DUAL_MONOLOG',
  name: 'Dual Monolog',
  summary: 'Drama 2 speaker',
  defaultDurationMin: 120,
  modules: ['timer', 'notes'],
  phases: [
    { no: 1, title: 'Praise & Bedah Lagu', minutes: 25, owner: 'Main Speaker', notes: 'Bedah makna.' },
    { no: 2, title: 'Dual Monolog', minutes: 25, owner: 'Main Speaker' },
    { no: 3, title: 'Deep Sharing', minutes: 40, owner: 'Mentor' },
    { no: 4, title: 'Persembahan', minutes: 10, owner: 'Main Speaker' },
  ],
  playbook:
    '# Dual\n\n## 1. Identitas & Tujuan\n\n## 2. Pra-acara\n\n## 3. Rundown\n\n## 4. Naskah siap baca\n\n## 5. Modul web & konfigurasi\n\n## 6. Peran & personil\n\n## 7. Adaptasi tema & firman\n\n{{tema}} {{firman_ref}} {{firman_text}} {{kitab_fokus}}',
};

describe('worship-patterns: helper katalog', () => {
  it('patternTotalMinutes menjumlahkan fase', () => {
    expect(patternTotalMinutes(FULL.phases)).toBe(100);
    expect(patternTotalMinutes(null)).toBe(0);
  });

  it('patternTemplateCheck lengkap untuk template 7 bagian + slot', () => {
    const c = patternTemplateCheck(FULL);
    expect(c.headingsMissing).toEqual([]);
    expect(c.slotsMissing).toEqual([]);
    expect(c.complete).toBe(true);
  });

  it('patternTemplateCheck mendeteksi template parsial', () => {
    const c = patternTemplateCheck({ code: 'X', name: 'X', playbook: '## 1. Identitas saja {{tema}}' });
    expect(c.complete).toBe(false);
    expect(c.headingsMissing.length).toBeGreaterThan(0);
    expect(c.slotsMissing).toContain('{{firman_ref}}');
  });

  it('patternDurationDelta menghitung selisih vs baku', () => {
    expect(patternDurationDelta(FULL)).toBe(-20);
    expect(patternDurationDelta({ code: 'X', name: 'X' })).toBeNull();
  });

  it('moduleLabel memetakan modul pola', () => {
    expect(moduleLabel('likert')).toBe('Likert');
    expect(moduleLabel('rounds')).toBe('Ronde');
    expect(moduleLabel('screening')).toBe('Pemutaran');
    expect(moduleLabel('teams')).toBe('Tim');
    expect(moduleLabel('activity')).toBe('Aktivitas & timer');
    expect(moduleLabel('fgd')).toBe('Panduan FGD');
    expect(moduleLabel('testimony')).toBe('Undian kesaksian');
    expect(moduleLabel('custom')).toBe('custom');
  });

  it('divisionLabel + prettyPlaybook: cakupan dan naskah siap baca', () => {
    expect(divisionLabel('didaskalia')).toBe('Didaskalia');
    expect(divisionLabel('MARTURIA')).toBe('Marturia');
    expect(divisionLabel(null)).toBe('');
    const pretty = prettyPlaybook('Renungkan {{tema}} dari {{firman_ref}}: {{firman_text}} ({{kitab_fokus}}).');
    expect(pretty).not.toContain('{{');
    expect(pretty).toContain('tema pekan');
    expect(pretty).toContain('Firman pekan');
    expect(pretty).toContain('nas Firman');
    expect(pretty).toContain('kitab fokus');
    expect(prettyPlaybook(null)).toBe('');
  });

  it('rundown 12 fase pola terbaru genap 120 menit', () => {
    const minutes = [10, 5, 15, 20, 25, 10, 5, 10, 5, 5, 5, 5];
    expect(
      patternTotalMinutes(minutes.map((m, i) => ({ no: i + 1, title: `Fase ${i + 1}`, minutes: m }))),
    ).toBe(120);
  });

  it('divisionLabel mengenal Diakonia', () => {
    expect(divisionLabel('diakonia')).toBe('Diakonia');
  });
});

describe('worship-patterns: timeline T-minus + paralel + varian', () => {
  const PRA = [
    { no: 1, title: 'Doa petugas', minutes: 5, anchor: 'PRA', parallelGroup: 'pra' },
    { no: null, title: 'Check perlengkapan', minutes: 5, anchor: 'PRA', parallelGroup: 'pra', track: 'parallel' },
    { no: null, title: 'Slide & sound', minutes: 5, anchor: 'PRA', parallelGroup: 'pra', track: 'parallel' },
    { no: 2, title: 'Registrasi', minutes: 10, anchor: 'PRA', parallelGroup: 'pra-reg' },
    { no: 3, title: 'Praise & Worship', minutes: 15, anchor: 'ACARA' },
  ] as never;

  it('paralel tak tambah total; PRA di luar total jemaat', () => {
    expect(patternTotalMinutes(PRA)).toBe(30);
    expect(patternCongregationMinutes(PRA)).toBe(15);
    expect(patternPreMinutes(PRA)).toBe(15);
  });

  it('timeline: PRA negatif, paralel warisi window grup', () => {
    const tl = patternTimeline(PRA);
    const byTitle = new Map(tl.map((t) => [String(t.title), t]));
    expect(byTitle.get('Doa petugas')).toMatchObject({ startMin: -15, endMin: -10 });
    expect(byTitle.get('Check perlengkapan')).toMatchObject({ startMin: -15, endMin: -10 });
    expect(byTitle.get('Registrasi')).toMatchObject({ startMin: -10, endMin: 0 });
    expect(byTitle.get('Praise & Worship')).toMatchObject({ startMin: 0, endMin: 15 });
    expect(isMainTrack({ track: 'parallel' } as never)).toBe(false);
    expect(isMainTrack(null)).toBe(true);
  });

  it('format relatif + absolut T0', () => {
    expect(formatRangeRel(-15, 0)).toBe('T-15–T0 · 15\'');
    expect(formatRangeAbs(-15, 0, '2026-10-12T13:00:00+07:00')).toBe('12:45–13:00');
    expect(formatRangeAbs(0, 15, null)).toBeNull();
  });

  it('parallelCheck memberi warning (bukan throw)', () => {
    expect(patternParallelCheck([{ title: 'X', minutes: 5, parallelGroup: 'g', track: 'parallel' }] as never))
      .toEqual(expect.arrayContaining([expect.stringContaining('tanpa main anchor')]));
    expect(patternParallelCheck([
      { title: 'Main', minutes: 5, parallelGroup: 'g' },
      { title: 'Besar', minutes: 9, parallelGroup: 'g', track: 'parallel' },
    ] as never).length).toBeGreaterThan(0);
    expect(patternParallelCheck(PRA)).toEqual([]);
  });

  it('varian: sanitasi default + delta PENUH + teks', () => {
    expect(sanitizePatternVariant(null)).toEqual({ opening: 'KEDUANYA', offering: 'HEMAT' });
    expect(sanitizePatternVariant({ opening: 'doa', offering: 'penuh' } as never)).toEqual({ opening: 'DOA', offering: 'PENUH' });
    expect(OFFERING_PENUH_DELTA_MIN).toBe(6);
    expect(patternTotalMinutes([{ title: 'A', minutes: 10 }] as never, { opening: 'LAGU', offering: 'PENUH' })).toBe(16);
    expect(patternVariantText({ opening: 'DOA', offering: 'PENUH' })).toContain('PENUH');
    expect(patternVariantText(null)).toContain('HEMAT');
  });

  it('patternBlock ikutkan varian pekan', () => {
    const lines = patternBlock({ code: 'MONOLOG', name: 'Monolog', phases: [], variant: { opening: 'DOA', offering: 'PENUH' } }).join('\n');
    expect(lines).toContain('Varian pekan');
    expect(lines).toContain('PENUH');
  });
});

describe('worship-patterns: patternBlock semua pola', () => {
  it('MONOLOG default FGD', () => {
    expect(patternBlock(undefined).join('\n')).toContain('FGD');
  });

  it('POST_TO_POST memakai rute kunjungan', () => {
    const lines = patternBlock({ code: 'POST_TO_POST', name: 'Post-to-Post', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('RUTE KUNJUNGAN');
  });

  it('DUAL_MONOLOG memakai deep sharing + blocking', () => {
    const lines = patternBlock({ code: 'DUAL_MONOLOG', name: 'Dual Monolog', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('deep sharing');
  });

  it('DEBAT memakai ronde + timer mutlak', () => {
    const lines = patternBlock({ code: 'DEBAT', name: 'Debat', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('timer mutlak');
  });

  it('BEDAH_FILM memakai Likert pre/post + undi 2', () => {
    const lines = patternBlock({ code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('Likert AWAL');
    expect(lines).toContain('undi 2 kesaksian');
  });

  it('THREE_SEQUENCES memakai 3 sesi + tim gabungan', () => {
    const lines = patternBlock({ code: 'THREE_SEQUENCES', name: 'Mission Sequence', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('tim gabungan');
    expect(lines).toContain('Sesi 3 · Mission Room');
    expect(lines).toContain('Penutup Sesi · Commissioning & Deklarasi');
    expect(lines).toContain('bukan di Konklusi');
  });

  it('CREATIVE_LAB playbook generik (tanpa narasi RUACH)', () => {
    const lines = patternBlock({ code: 'CREATIVE_LAB', name: 'Creative Lab', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('template bebas aktivitas');
    expect(lines).toContain('10 rumah Beyonders');
    expect(lines).toContain('Suka/Biasa/Kurang');
    expect(lines).not.toContain('Reminder Jar');
    expect(lines).not.toContain('Ruach');
    expect(lines).not.toContain('Grow What You Believe');
    expect(lines).toContain('perwakilan');
  });

  it('phase notes + division ikut ke prompt AI', () => {
    const lines = patternBlock({
      code: 'MONOLOG',
      name: 'Monolog',
      phases: [{ no: 4, title: 'FGD kelompok', minutes: 35, owner: 'Mentor', division: 'DIDASKALIA', notes: 'Observasi 10 mnt' }],
    }).join('\n');
    expect(lines).toContain('Observasi 10 mnt');
    expect(lines).toContain('[cakupan DIDASKALIA]');
  });
});
