import { describe, expect, it } from 'vitest';
import {
  buildPembekalanDeck,
  contentFromStudio,
  extractGarisBesar,
  extractKeySentence,
  khutbahHashFor,
} from '../../src/lib/didaskalia-presentation';
import { buildPembekalanCaption } from '../../src/lib/rhb-caption';
import { defaultStudio } from '../../src/lib/didaskalia';

const OUTLINE = {
  pengantar: 'Manusia mengira masalah terbesar adalah finansial dan masa depan. Padahal masalah terbesar adalah dosa yang memisahkan dari Allah yang Mahasuci.',
  bedahTeologis: [
    'A. Pribadi yang Sempurna: Yesus satu-satunya manusia tanpa dosa.',
    'B. Titik Balik: Allah memperlakukan Yesus seolah pelaku dosa kita.',
    'Poin Utama bagi Anak Muda: status kita diubahkan secara permanen.',
  ].join('\n\n'),
  jembatan: 'Teks utama bukan akhir cerita: pelepasan → kewarganegaraan baru → pengampunan mutlak.',
  kesimpulan: 'Anda tidak butuh sekadar perbaikan nasib sementara. Terimalah pertukaran besar hari ini!',
};

function fullStudio() {
  const studio = defaultStudio();
  studio.sermon = {
    ...studio.sermon,
    teksUtama: { ref: '2 Korintus 5:21', text: '' },
    outline: { ...OUTLINE },
    deliveryPlan: [{ method: 'Narasi', how: 'Buka dengan cerita.' }],
    prepChecklist: ['Doa', 'Latihan'],
    discussionFlow: ['Q1', 'Q2', 'Q3', 'Q4'],
  };
  return studio;
}

describe('extractKeySentence (verbatim)', () => {
  it('mengutamakan baris takeaway', () => {
    expect(extractKeySentence(OUTLINE.bedahTeologis)).toBe(
      'Poin Utama bagi Anak Muda: status kita diubahkan secara permanen.'
    );
  });

  it('mengambil kalimat pertama bila tanpa takeaway', () => {
    expect(extractKeySentence(OUTLINE.pengantar)).toBe(
      'Manusia mengira masalah terbesar adalah finansial dan masa depan.'
    );
  });

  it('mengkupas penanda list tanpa mengubah kata', () => {
    expect(extractKeySentence('A. Pribadi yang Sempurna: Yesus satu-satunya manusia tanpa dosa.')).toBe(
      'Pribadi yang Sempurna: Yesus satu-satunya manusia tanpa dosa.'
    );
  });

  it('memotong panjang di batas kata + elipsis', () => {
    const long = `${'kata '.repeat(60)}. Kalimat kedua.`;
    const s = extractKeySentence(long);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(205);
    expect(long.startsWith(s.replace(/ …$/, ''))).toBe(true);
  });

  it('kosong menghasilkan string kosong', () => {
    expect(extractKeySentence('')).toBe('');
    expect(extractKeySentence(undefined)).toBe('');
    expect(extractKeySentence('---')).toBe('');
  });
});

describe('extractGarisBesar', () => {
  it('4 komponen urutan tetap, yang kosong dilewati', () => {
    const g = extractGarisBesar({ ...OUTLINE, jembatan: '' });
    expect(g.map((x) => x.key)).toEqual(['pengantar', 'bedahTeologis', 'kesimpulan']);
    expect(g.map((x) => x.no)).toEqual(['1', '2', '4']);
  });

  it('setiap kalimat adalah prefix verbatim dari sumbernya', () => {
    const g = extractGarisBesar(OUTLINE);
    expect(g).toHaveLength(4);
    for (const item of g) {
      const src = OUTLINE[item.key].replace(/\s+/g, ' ');
      const plain = item.sentence.replace(/ …$/, '');
      expect(src).toContain(plain.slice(0, 20));
    }
  });
});

describe('khutbahHashFor', () => {
  it('menunjuk doc 02 pekan yang sama', () => {
    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'Tema');
    expect(khutbahHashFor(content)).toBe('#/materi/khutbah/2026-10/2');
  });

  it('fallback aman bila tanggal tak valid', () => {
    const content = contentFromStudio(fullStudio(), 1, '', 'Tema');
    expect(khutbahHashFor(content)).toBe('#/materi/khutbah');
  });
});

describe('buildPembekalanDeck (garis besar + CTA)', () => {
  it('garis besar memakai penanda heading ala khotbah + CTA doc 02', () => {
    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildPembekalanDeck(content);
    const garis = deck.find((s) => s.id === 'garis-besar');
    expect(garis?.paragraphs).toHaveLength(4);
    expect(garis?.paragraphs?.[1]).toContain('#### 2. Bedah Teologis');
    expect(garis?.cta).toEqual({
      label: 'Buka Ringkasan Khotbah',
      href: '#/materi/khutbah/2026-10/2',
      text: 'Detail 4 bagian verbatim',
    });
  });

  it('Bagian A kosong disembunyikan (standar: buang slide kosong)', () => {
    const studio = defaultStudio();
    studio.sermon = { ...studio.sermon, outline: { ...OUTLINE } };
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema'));
    expect(deck.find((s) => s.id === 'a-deliver')).toBeFalsy();
    // Garis besar + CTA tetap ada (callout/cta menjaga slide).
    expect(deck.find((s) => s.id === 'garis-besar')).toBeTruthy();
  });

  it('MONOLOG menampilkan seluruh Q (maks 6) + tugas operasional', () => {
    const studio = fullStudio();
    studio.sermon.discussionFlow = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema', null, null, 'MONOLOG'));
    const b = deck.find((s) => s.id === 'b-pola');
    expect(b?.fields).toHaveLength(6);
    expect(b?.bullets?.join('\n')).toContain('Absensi:');
    expect(b?.bullets?.join('\n')).toContain('Update monitoring:');
  });
});

describe('caption pembekalan (tanpa bigIdea AI)', () => {
  it('memuat teks utama + tautan doc 02, tanpa inti pesan AI', () => {
    const studio = fullStudio();
    studio.sermon.bigIdea = 'BIG IDEA AI YANG WAJIB DIABAIKAN';
    const content = contentFromStudio(studio, 2, '2026-10-11', 'The Rescue Plan');
    const text = buildPembekalanCaption({ doc: 'pembekalan', yearMonth: '2026-10', weekIndex: 2, content, origin: 'https://youth.gehc.page' });
    expect(text).not.toContain('WAJIB DIABAIKAN');
    expect(text).toContain('2 Korintus 5:21');
    expect(text).toContain('https://youth.gehc.page/#/materi/pembekalan/2026-10/2');
    expect(text).toContain('https://youth.gehc.page/#/materi/khutbah/2026-10/2');
  });
});
