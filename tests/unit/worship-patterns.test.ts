import { describe, expect, it } from 'vitest';
import { patternBlock } from '../../server/lib/didaskalia-ai.mjs';
import {
  moduleLabel,
  patternDurationDelta,
  patternTemplateCheck,
  patternTotalMinutes,
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
    expect(moduleLabel('custom')).toBe('custom');
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

  it('BEDAH_FILM memakai pleno', () => {
    const lines = patternBlock({ code: 'BEDAH_FILM', name: 'Bedah Film', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('pleno');
  });

  it('THREE_SEQUENCES memakai 3 sequence + commissioning', () => {
    const lines = patternBlock({ code: 'THREE_SEQUENCES', name: '3 Sequences', phases: [], playbook: 'x' }).join('\n');
    expect(lines).toContain('3 sequence');
  });

  it('phase notes ikut ke prompt AI', () => {
    const lines = patternBlock({
      code: 'MONOLOG',
      name: 'Monolog',
      phases: [{ no: 4, title: 'FGD kelompok', minutes: 35, owner: 'Mentor', notes: 'Observasi 10 mnt' }],
    }).join('\n');
    expect(lines).toContain('Observasi 10 mnt');
  });
});
