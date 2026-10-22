import { describe, expect, it } from 'vitest';
import {
  canonicalCreativeLabPhases as serverPhases,
  normalizeCreativeLabPhases as serverNorm,
  presentWorshipPattern,
} from '../../server/lib/creative-lab-rundown.mjs';
import {
  canonicalCreativeLabPhases as clientPhases,
  labDisplayShowsRepNames,
  normalizeCreativeLabPhases as clientNorm,
} from '../../src/lib/creative-lab-rundown';
import { patternCongregationMinutes, patternPreMinutes, patternTotalMinutes } from '../../src/lib/worship-patterns';

const LEGACY = [
  { no: 1, title: 'Praise & Worship', minutes: 15 },
  { no: 2, title: 'Preaching & Briefing', minutes: 15 },
  { no: 3, title: 'Activity 1 — The Roots Reminder Jar', minutes: 15 },
  { no: null, title: 'Pilih 2 pertanyaan untuk web', minutes: 15, track: 'parallel' },
  { no: 4, title: 'Activity 2 — Pot Painting (Grow What You Believe)', minutes: 25 },
  { no: null, title: 'Bag Painting (Carry The Gospel)', minutes: 25, track: 'parallel' },
  { no: 5, title: 'Presentasi hasil', minutes: 10 },
  { no: 6, title: 'Conclusion', minutes: 10 },
  { no: 7, title: 'Persembahan + doa', minutes: 10 },
];

describe('creative lab rundown: baca katalog lama', () => {
  it('klien dan server memakai judul serta menit yang sama', () => {
    const a = serverPhases();
    const b = clientPhases();
    expect(b.map((p) => [p.title, p.minutes, p.track || 'main', p.anchor])).toEqual(
      a.map((p) => [p.title, p.minutes, p.track || 'main', p.anchor]),
    );
  });

  it('judul legacy menjadi rundown baku 20 + 140', () => {
    const phases = serverNorm(LEGACY, 'CREATIVE_LAB');
    expect(phases.map((p) => p.title)).toEqual([
      'Persiapan Ruang & Perlengkapan',
      'Doa Petugas',
      'Registrasi Ulang',
      'Cek Slide & Sound',
      'Praise & Worship',
      'Firman & Briefing',
      'Sesi 1 · Reminder Jar',
      'Sesi 2 · Art Stations',
      'Presentasi Kelompok',
      'Konklusi',
      'Persembahan & Doa',
      'Lagu & Doa Penutup',
      'Terima Kasih & Pengumuman',
      'HUT & Doa',
      'Foto Bersama',
      'Acara Bebas & Pulang',
    ]);
    expect(phases.find((p) => p.title === 'Presentasi Kelompok')?.minutes).toBe(30);
    expect(phases.find((p) => p.title === 'Firman & Briefing')?.minutes).toBe(15);
    expect(phases.find((p) => p.title === 'Firman & Briefing')?.notes || '').toMatch(/pencatat/);
    expect(phases.find((p) => p.title === 'Persiapan Ruang & Perlengkapan')?.notes || '').toMatch(/kedatangan/);
    expect(phases.some((p) => /bag painting|pilih 2 pertanyaan|preaching/i.test(String(p.title)))).toBe(false);
    expect(patternPreMinutes(phases)).toBe(20);
    expect(patternCongregationMinutes(phases)).toBe(140);
    expect(patternTotalMinutes(phases)).toBe(160);
    const pasca = phases.slice(-4);
    expect(pasca.map((p) => p.minutes)).toEqual([5, 5, 5, 5]);
    expect(pasca.map((p) => p.owner)).toEqual([
      'Tuan Rumah, MC, Komisi/Tim Kerja',
      'MC, yang HUT',
      'Fotografer, Videografer',
      'Tuan Rumah',
    ]);
    expect(clientNorm(LEGACY).map((p) => p.title)).toEqual(phases.map((p) => p.title));
  });

  it('pola lain dan rundown yang sudah baku tidak ditimpa', () => {
    const mono = [{ title: 'Persembahan + doa', minutes: 10 }];
    expect(serverNorm(mono, 'MONOLOG')).toBe(mono);
    const custom = [{ title: 'Sesi 1 · Reminder Jar', minutes: 15, notes: 'catatan khusus' }];
    expect(serverNorm(custom, 'CREATIVE_LAB')).toBe(custom);
    expect(clientNorm(mono)).toBe(mono);
  });

  it('ringkasan tampilan ikut judul baku bila fase masih legacy', () => {
    const shown = presentWorshipPattern({
      code: 'CREATIVE_LAB',
      name: 'Creative Lab',
      summary: 'The Roots Reminder Jar 15',
      defaultDurationMin: 160,
      phases: LEGACY,
    });
    expect(shown.summary).toContain('Sesi 1 · Reminder Jar');
    expect(shown.summary).not.toContain('The Roots');
    expect(shown.phases.find((p) => p.title === 'Sesi 2 · Art Stations')?.minutes).toBe(25);
    expect(shown.defaultDurationMin).toBe(160);
  });

  it('nama perwakilan dan pencatat hanya di layar Sesi 2', () => {
    expect(labDisplayShowsRepNames('A2')).toBe(true);
    expect(labDisplayShowsRepNames('IDLE')).toBe(false);
    expect(labDisplayShowsRepNames('A1')).toBe(false);
    expect(labDisplayShowsRepNames('PRESENT')).toBe(false);
    expect(labDisplayShowsRepNames('DONE')).toBe(false);
    expect(labDisplayShowsRepNames('')).toBe(false);
  });
});
