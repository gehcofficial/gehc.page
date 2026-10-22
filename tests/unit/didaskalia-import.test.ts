import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { extractPdfText } from '../../server/lib/pdf-text.mjs';
import {
  canonRef,
  guardNormalized,
  parseImportedRhb,
  parseRhbFullMd,
  parseServiceMd,
  toStandardRhbMd,
  toStandardServiceMd,
} from '../../server/lib/didaskalia-md.mjs';

async function pdfText(name: string) {
  const buf = readFileSync(new URL(`../fixtures/didaskalia/${name}`, import.meta.url));
  return extractPdfText(buf);
}

describe('parser naskah rekan (PDF polos)', () => {
  it('RHB 25–31 Okt 2026: 7/7 Path dengan Nats Pembimbing', async () => {
    const out = parseRhbFullMd(await pdfText('rhb-2026-10-w4.pdf'));
    expect(out.ok).toBe(true);
    expect(out.missing).toEqual([]);
    expect(out.paths).toHaveLength(7);
    expect(out.paths.map((p) => p.title)).toEqual([
      'KASIH YANG MENERUSKAN INJIL',
      'JANGAN BIARKAN API ITU PADAM',
      'TIDAK MALU AKAN INJIL',
      'ANUGERAH MENDAHULUI PERBUATAN KITA',
      'INJIL YANG LAYAK DIPERJUANGKAN',
      'PELIHARA HARTA YANG DIPERCAYAKAN',
      'TERUSKAN INJIL, JADILAH PEMBERITA',
    ]);
    expect(out.paths.map((p) => p.scriptureRef)).toEqual([
      'Yohanes 4:13--14',
      'Roma 12:11',
      '1 Korintus 1:18',
      'Yesaya 49:15',
      'Filipi 1:12--14',
      '2 Timotius 2:2',
      'Matius 9:37--38',
    ]);
    expect(out.paths[0].sections.PENGANTAR).toMatch(/Samaria/);
    expect(out.paths[6].bridge).toMatch(/Four Witnesses/);
    const again = parseRhbFullMd(toStandardRhbMd(out.paths));
    expect(again.ok).toBe(true);
    expect(again.paths[0].scriptureRef).toBe('Yohanes 4:13--14');
  });

  it('Serving Day: Fondasi = Pengantar, Kitab Fundamental = teks utama, Kitab Bagian Fokus', async () => {
    const out = parseServiceMd(await pdfText('service-2026-10-w4.pdf'));
    expect(out.ok).toBe(true);
    expect(out.missing).toEqual([]);
    expect(out.info.tema).toBe('Our Roots & DNA');
    expect(out.info.teksUtama).toBe('1 Korintus 1:13');
    expect(out.info.kitabFokus).toBe('2 Timotius 1:3--18');
    expect(out.outline.pengantar).toMatch(/Riedel/);
    expect(out.outline.bedahTeologis).toMatch(/salib/i);
    expect(out.outline.jembatan).toMatch(/Lois/);
    expect(out.outline.kesimpulan).toMatch(/1 Korintus 1:13/);
    const again = parseServiceMd(toStandardServiceMd(out));
    expect(again.ok).toBe(true);
    expect(again.info.teksUtama).toBe('1 Korintus 1:13');
  });

  it('kepala "Path 1 Minggu 25 Oktober" dan alias Nas/Nats tetap terbaca', () => {
    const raw = [
      'Path 1 Minggu 25 Oktober',
      'Judul Indonesia',
      'Nats Pembimbing: Roma 12:11',
      'Pengantar',
      'Teks pengantar.',
      'Pembahasan Tematis',
      'Bahasan.',
      'Makna dan Implikasi bagi Beyonders',
      'Makna.',
      'Pertanyaan untuk Refleksi Pribadi',
      '1. Refleksi?',
      'Pertanyaan untuk Diskusi Kelompok',
      '1. Diskusi?',
      'Jembatan ke Path 2',
      'Jembatan.',
    ].join('\n');
    const out = parseImportedRhb(raw);
    expect(out.mode).toBe('full');
    const first = out.paths[0] as { title: string; scriptureRef: string; sections?: Record<string, string> };
    expect(first.title).toBe('Judul Indonesia');
    expect(first.scriptureRef).toBe('Roma 12:11');
    expect(first.sections?.PENGANTAR).toBe('Teks pengantar.');
  });
});

describe('guardNormalized', () => {
  const source = [
    '# PATH 1 — Minggu',
    '## Judul Asli',
    '**Nats Pembimbing: Yohanes 4:13-14**',
    '### Pengantar',
    'Yesus di sumur. Lihat Yohanes 4:28-30.',
    '### Pembahasan Tematis',
    'Air hidup.',
    '### Makna dan Implikasi bagi Beyonders',
    'Bagikan.',
    '### Pertanyaan untuk Refleksi Pribadi',
    '1. Apa?',
    '### Pertanyaan untuk Diskusi Kelompok',
    '1. Mengapa?',
    '### Jembatan',
    'Besok.',
  ].join('\n');

  it('mengembalikan nats dan bagian yang kehilangan ayat', () => {
    const mutated = source
      .replace('Yohanes 4:13-14', 'Yohanes 9:99')
      .replace('Lihat Yohanes 4:28-30.', 'Lihat ayat lain.');
    const guarded = guardNormalized('rhb', source, mutated);
    expect(canonRef(guarded.preview.paths[0].scriptureRef)).toBe(canonRef('Yohanes 4:13-14'));
    expect(guarded.preview.paths[0].sections.PENGANTAR).toMatch(/Yohanes 4:28-30/);
    expect(guarded.warnings.some((w) => /Nats Pembimbing dikembalikan|Referensi ayat hilang/.test(w.note))).toBe(true);
    expect(guarded.normalized).toMatch(/\*\*Nats Pembimbing:/);
  });

  it('mengembalikan bagian Serving Day yang diringkas menjadi satu kalimat', () => {
    const long = 'Uraian naskah sumber yang memuat poin, subpoin, dan penerapan. '.repeat(12);
    const source = toStandardServiceMd({
      info: { tema: 'Our Roots & DNA', teksUtama: '1 Korintus 1:13', kitabFokus: '2 Timotius 1:3--18' },
      outline: {
        pengantar: long,
        bedahTeologis: 'Bedah yang tetap panjang dan tidak diringkas menjadi satu kalimat oleh penyunting.',
        jembatan: '',
        kesimpulan: '',
      },
    });
    const shortened = source.replace(long.trim(), 'Pentingnya kembali ke akar identitas kita.');
    const guarded = guardNormalized('service', source, shortened);
    expect(guarded.preview.outline.pengantar.length).toBeGreaterThan(400);
    expect(guarded.preview.outline.pengantar).toContain('subpoin');
    expect(guarded.warnings.some((w) => /jauh lebih pendek/.test(w.note))).toBe(true);
  });
});
