import { describe, expect, it } from 'vitest';
import {
  buildKhutbahDeck,
  chunkSermonSection,
  contentFromStudio,
} from '../../src/lib/didaskalia-presentation';
import { defaultStudio } from '../../src/lib/didaskalia';

const MD_PENGANTAR = 'Manusia mengira masalah terbesar adalah finansial dan masa depan.\n\nPadahal masalah terbesar adalah dosa yang memisahkan dari Allah yang Mahasuci.';
const MD_BEDAH = [
  'A. Pribadi yang Sempurna: Yesus satu-satunya manusia tanpa dosa.',
  'B. Titik Balik: Allah memperlakukan Yesus seolah pelaku dosa kita.',
  'C. Hasil Akhir: dalam Dia kita dibenarkan oleh Allah.',
  'Poin Utama bagi Anak Muda: status kita diubahkan secara permanen.',
].join('\n\n');

describe('chunkSermonSection (budget layar)', () => {
  it('bagian kosong menghasilkan nol chunk', () => {
    expect(chunkSermonSection('')).toEqual([]);
    expect(chunkSermonSection(undefined)).toEqual([]);
  });

  it('bagian pendek menjadi satu chunk verbatim', () => {
    const chunks = chunkSermonSection(MD_PENGANTAR);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual([
      'Manusia mengira masalah terbesar adalah finansial dan masa depan.',
      'Padahal masalah terbesar adalah dosa yang memisahkan dari Allah yang Mahasuci.',
    ]);
  });

  it('budget diketatkan memecah di batas bullet tanpa mengubah kata', () => {
    const chunks = chunkSermonSection(MD_BEDAH, 3, 2);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(MD_BEDAH.split('\n\n'));
  });

  it('chunk sampah (pemisah ---) dibuang, tak jadi slide kosong', () => {
    const chunks = chunkSermonSection('Isi bagian.\n\n---');
    expect(chunks).toEqual([['Isi bagian.']]);
    expect(chunkSermonSection('---')).toEqual([]);
  });

  it('prosa campur list dipecah di transisi, heading menempel ke isi', () => {
    const md = 'Intro prosa.\n1. Pertama\n2. Kedua\n\n#### Sub\n* A\n* B';
    const chunks = chunkSermonSection(md, 9, 5);
    const flat = chunks.flat();
    expect(flat[0]).toBe('Intro prosa.');
    expect(flat[1]).toBe('1. Pertama');
    const subIdx = flat.findIndex((u) => u.startsWith('####'));
    expect(subIdx).toBeGreaterThanOrEqual(0);
    // heading tidak menggantung di akhir chunk
    for (let i = 0; i < chunks.length - 1; i++) {
      const last = chunks[i][chunks[i].length - 1];
      if (/^\s*#{2,4}\s+/.test(last)) {
        expect(chunks[i].length).toBe(1);
      }
    }
    expect(flat[subIdx + 1]).toBe('* A');
  });

  it('tiap chunk dalam budget: ≤6 baris estimasi & ≤4 bullet', () => {
    const long = Array.from({ length: 10 }, (_, i) => `* Poin ${i + 1} dengan uraian secukupnya agar rapi dibaca.`);
    const chunks = chunkSermonSection(long.join('\n'));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(4);
      expect(c.every((u) => u.trim().length > 0)).toBe(true);
    }
  });
});

describe('buildKhutbahDeck (standar literal)', () => {
  function literalStudio() {
    const studio = defaultStudio();
    studio.sermon = {
      ...studio.sermon,
      bigIdea: 'BIG IDEA AI YANG WAJIB DIABAIKAN',
      summary: 'SUMMARY AI YANG WAJIB DIABAIKAN',
      teksUtama: { ref: '2 Korintus 5:21', text: '' },
      outline: {
        pengantar: MD_PENGANTAR,
        bedahTeologis: MD_BEDAH,
        jembatan: 'Jembatan singkat.',
        kesimpulan: '',
      },
      slideOutline: [{ title: 'Slide AI lama', bullets: ['a'], visualNote: '' }],
    };
    studio.fundamentalFirman = { ref: 'Kolose 1:13-14', text: '' };
    studio.presentation = { cover: 'cover-id', khutbahLiteral: { bedahTeologis: 'bedah-img' } };
    return studio;
  }

  it('hanya render cover + 4 bagian verbatim (tanpa summary/slideOutline AI)', () => {
    const content = contentFromStudio(literalStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildKhutbahDeck(content);
    const ids = deck.map((s) => s.id);
    expect(ids[0]).toBe('cover');
    expect(ids).toContain('outline-pengantar');
    expect(ids).toContain('outline-jembatan');
    expect(ids).not.toContain('inti');
    expect(ids.some((id) => id.startsWith('slide-'))).toBe(false);
    const allText = deck.flatMap((s) => s.paragraphs || []).join('\n');
    expect(allText).not.toContain('WAJIB DIABAIKAN');
    expect(allText).toContain('Manusia mengira masalah terbesar');
  });

  it('bagian kosong dilewati, bagian panjang jadi bernomor', () => {
    const content = contentFromStudio(literalStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildKhutbahDeck(content);
    expect(deck.map((s) => s.id)).not.toContain('outline-kesimpulan');
    const bedah = deck.filter((s) => s.id.startsWith('outline-bedahTeologis'));
    expect(bedah.length).toBeGreaterThanOrEqual(1);
    if (bedah.length > 1) {
      expect(bedah[0].kicker).toContain('1/2');
    }
  });

  it('gambar per bagian dipakai sebagai background, fallback ke cover', () => {
    const content = contentFromStudio(literalStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildKhutbahDeck(content);
    const bedah = deck.find((s) => s.id.startsWith('outline-bedahTeologis'));
    expect(bedah?.imageFileId).toBe('bedah-img');
    expect(bedah?.background).toBe(true);
    const pengantar = deck.find((s) => s.id === 'outline-pengantar');
    expect(pengantar?.imageFileId).toBe('cover-id');
  });

  it('cover memuat teks utama + teks jangkar (tanpa bigIdea AI)', () => {
    const content = contentFromStudio(literalStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildKhutbahDeck(content);
    const cover = deck[0];
    const fields = (cover.fields || []).map((f) => `${f.label}: ${f.value}`).join(' | ');
    expect(fields).toContain('2 Korintus 5:21');
    expect(fields).toContain('Kolose 1:13-14');
  });
});
