import { describe, expect, it } from 'vitest';
import {
  buildKhutbahDeck,
  buildPembekalanDeck,
  buildRhbDayDeck,
  contentFromStudio,
  extractGarisBesar,
  extractKeySentence,
  khutbahHashFor,
} from '../../src/lib/didaskalia-presentation';
import { buildPembekalanCaption } from '../../src/lib/rhb-caption';
import { defaultStudio, ensureRhbSections } from '../../src/lib/didaskalia';

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
  it('garis besar dipecah maks 2 komponen per slide + CTA doc 02 di terakhir', () => {
    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildPembekalanDeck(content);
    const garis = deck.filter((s) => s.id.startsWith('garis-besar'));
    expect(garis).toHaveLength(2);
    expect(garis[0].paragraphs).toHaveLength(2);
    expect(garis[0].paragraphs?.[1]).toContain('#### 2. Bedah Teologis');
    expect(garis[0].title).toContain('(1/2)');
    expect(garis[0].cta).toBeUndefined();
    expect(garis[1].cta).toEqual({
      label: 'Buka Ringkasan Khotbah',
      href: '#/materi/khutbah/2026-10/2',
      text: 'Detail 4 bagian verbatim',
    });
  });

  it('Bagian A kosong disembunyikan (standar: buang slide kosong)', () => {
    const studio = defaultStudio();
    studio.sermon = { ...studio.sermon, outline: { ...OUTLINE } };
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema'));
    expect(deck.find((s) => s.id.startsWith('a-deliver'))).toBeFalsy();
    expect(deck.find((s) => s.id.startsWith('a-checklist'))).toBeFalsy();
    // Garis besar + CTA tetap ada (callout/cta menjaga slide).
    expect(deck.some((s) => s.id.startsWith('garis-besar'))).toBe(true);
  });

  it('MONOLOG: Q ≤3 per slide + tugas operasional di slide teknis', () => {
    const studio = fullStudio();
    studio.sermon.discussionFlow = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema', null, null, 'MONOLOG'));
    const qSlides = deck.filter((s) => s.id.startsWith('b-pola'));
    expect(qSlides).toHaveLength(3);
    expect(qSlides[0].fields?.map((f) => f.label)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(qSlides[2].fields?.map((f) => f.label)).toEqual(['Q7']);
    const teknis = deck.filter((s) => s.id.startsWith('b-teknis')).flatMap((s) => s.bullets || []);
    expect(teknis.join('\n')).toContain('Absensi:');
    expect(teknis.join('\n')).toContain('Update monitoring:');
    for (const t of deck.filter((s) => s.id.startsWith('b-teknis'))) {
      expect((t.bullets || []).length).toBeLessThanOrEqual(4);
    }
  });

  it('penutup 1 slide ringkas: baris standar hari + judul + CTA RHB', () => {    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildPembekalanDeck(content);
    const tutup = deck.filter((s) => s.id.startsWith('penutup'));
    expect(tutup).toHaveLength(1);
    expect(tutup[0].fields).toHaveLength(7);
    expect(tutup[0].fields?.[0].label).toBe('Minggu');
    expect(tutup[0].bullets).toBeUndefined();
    expect(tutup[0].callout?.label).toBe('Lanjut RHB');
    expect(tutup[0].cta).toEqual({
      label: 'Buka RHB 7 Hari',
      href: '#/materi/rhb/2026-10/2',
      text: 'Indeks renungan sepekan',
    });
  });

  it('checklist panjang dipecah ≤4 per slide', () => {
    const studio = fullStudio();
    studio.sermon.prepChecklist = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema'));
    const checks = deck.filter((s) => s.id.startsWith('a-checklist'));
    expect(checks).toHaveLength(2);
    expect(checks[0].bullets).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(checks[1].bullets).toEqual(['c5', 'c6']);
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

describe('hideTitle (cakupan: pembekalan + RHB, khutbah utuh)', () => {
  it('semua slide isi pembekalan tanpa h1; cover + penutup tetap bertitel', () => {
    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildPembekalanDeck(content);
    for (const s of deck) {
      if (s.id === 'cover' || s.id === 'penutup') expect(s.hideTitle).toBeFalsy();
      else expect(s.hideTitle).toBe(true);
    }
  });

  it('slide section RHB tanpa h1; cover + closing tetap bertitel', () => {
    const studio = fullStudio();
    studio.paths[0] = {
      ...studio.paths[0],
      rhbSections: ensureRhbSections(studio.paths[0].rhbSections).map((s) => (s.key === 'PENGANTAR' ? { ...s, body: 'Isi pengantar.' } : s)),
    };
    const deck = buildRhbDayDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema'), 1);
    expect(deck.some((s) => s.kind === 'section')).toBe(true);
    for (const s of deck) {
      if (s.kind === 'section') expect(s.hideTitle).toBe(true);
      else expect(s.hideTitle).toBeFalsy();
    }
  });

  it('deck khutbah tidak tersentuh (tetap pakai h1)', () => {
    const content = contentFromStudio(fullStudio(), 2, '2026-10-11', 'The Rescue Plan');
    const deck = buildKhutbahDeck(content);
    expect(deck.length).toBeGreaterThan(1);
    for (const s of deck) expect(s.hideTitle).toBeFalsy();
  });
});
