import { describe, expect, it } from 'vitest';
import {
  buildPembekalanDeck,
  buildRhbDayDeck,
  contentFromStudio,
  effectiveRhbSections,
  materialAbsoluteUrl,
  materialHashPath,
  parseMaterialHash,
  rhbDayList,
} from '../../src/lib/didaskalia-presentation';
import { buildDayCaption, buildWeekCaption } from '../../src/lib/rhb-caption';
import { defaultStudio, ensurePaths, ensureRhbSections } from '../../src/lib/didaskalia';

function studioWithRhb() {
  const studio = defaultStudio();
  studio.chapterNo = '3';
  studio.sermon = {
    ...studio.sermon,
    deliveryPlan: [{ method: 'Teologi Historis', how: 'Buka latar sejarah pelayanan.' }],
    prepChecklist: ['Riset teks', 'Latihan'],
    discussionFlow: ['Pemanasan tema', 'Gali teks', 'Terapkan'],
  };
  studio.paths = ensurePaths(studio).map((p, i) => ({
    ...p,
    title: `Path ${i + 1} judul`,
    summary: `Ringkasan hari ${i + 1}`,
    rhbSections: ensureRhbSections(p.rhbSections).map((s, si) =>
      si === 0 ? { ...s, body: `Isi ${s.key} hari ${i + 1}` } : s
    ),
  }));
  return studio;
}

describe('parseMaterialHash', () => {
  it('mengurai rute dokumen pekan', () => {
    expect(parseMaterialHash('#/materi/pembekalan/2026-09/2')).toEqual({
      doc: 'pembekalan',
      yearMonth: '2026-09',
      weekIndex: 2,
    });
  });

  it('mengurai rute RHB harian', () => {
    expect(parseMaterialHash('#/materi/rhb/2026-09/1/3')).toEqual({
      doc: 'rhb',
      yearMonth: '2026-09',
      weekIndex: 1,
      dayIndex: 3,
    });
  });

  it('menolak rute tidak valid', () => {
    expect(parseMaterialHash('#/materi/rhb/2026-9/1')).toBeNull();
    expect(parseMaterialHash('#/materi/unknown/2026-09/1')).toBeNull();
    expect(parseMaterialHash('#/materi/rhb/2026-09/9')).toBeNull();
    expect(parseMaterialHash('#/materi/rhb/2026-09/1/9')).toBeNull();
    expect(parseMaterialHash('#/portal')).toBeNull();
  });

  it('membangun kembali path & URL absolut', () => {
    const route = { doc: 'rhb' as const, yearMonth: '2026-09', weekIndex: 1, dayIndex: 2 };
    expect(materialHashPath(route)).toBe('#/materi/rhb/2026-09/1/2');
    expect(materialAbsoluteUrl(route, 'https://youth.gehc.page')).toBe('https://youth.gehc.page/#/materi/rhb/2026-09/1/2');
  });
});

describe('deck builders', () => {
  it('pembekalan: cover + garis 4 komponen + A deliver + B pola + penutup (tanpa slide AI / literal penuh)', () => {
    const studio = studioWithRhb();
    studio.sermon = { ...studio.sermon, slideOutline: [{ title: 'S1', bullets: ['b1', 'b2'], visualNote: '' }, { title: 'S2', bullets: [], visualNote: '' }], outline: { pengantar: 'P1', bedahTeologis: '', jembatan: 'J1', kesimpulan: 'K1' } };
    const deck = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema Pekan'));
    expect(deck[0].kind).toBe('cover');
    expect(deck[0].title).toBe('Tema Pekan');
    expect(deck[deck.length - 1].kind).toBe('closing');
    // Tidak ada lagi slide breakdown per-Path (diganti 1 slide summary 7 hari).
    expect(deck.filter((s) => s.kind === 'path')).toHaveLength(0);
    // Slide AI lama terhapus (summary/kerangka/slideOutline), diganti garis besar.
    for (const gone of ['a-ringkasan', 'b-fgd', 'b-7hari', 'a-khotbah', 'a-kerangka', 'inti']) {
      expect(deck.find((s) => s.id === gone)).toBeFalsy();
    }
    // Tak ada duplikasi literal penuh doc 02 di modul 01.
    expect(deck.some((s) => s.id.startsWith('a-khotbah-'))).toBe(false);
    // Pagination baca: garis 3 komponen → 2 slide; teknis 6 bullet → 2 slide; penutup 7 hari → 2 slide.
    expect(deck.map((s) => s.id)).toEqual(['cover', 'garis-besar-1', 'garis-besar-2', 'a-deliver', 'a-checklist', 'b-pola', 'b-teknis-1', 'b-teknis-2', 'penutup-1', 'penutup-2']);
    const garis1 = deck.find((s) => s.id === 'garis-besar-1');
    expect(garis1?.paragraphs).toHaveLength(2);
    expect(garis1?.paragraphs?.[0]).toContain('P1');
    expect(garis1?.title).toContain('(1/2)');
    const garis2 = deck.find((s) => s.id === 'garis-besar-2');
    expect(garis2?.cta?.href).toBe('#/materi/khutbah/2026-09/1');
    expect(garis2?.callout?.label).toBe('Detail Penuh');
    const deliver = deck.find((s) => s.id === 'a-deliver');
    expect(deliver?.fields).toEqual([{ label: 'Teologi Historis', value: 'Buka latar sejarah pelayanan.' }]);
    expect(deliver?.bullets).toBeUndefined();
    const checklist = deck.find((s) => s.id === 'a-checklist');
    expect(checklist?.bullets).toEqual(['Riset teks', 'Latihan']);
    const penutup = deck.find((s) => s.id === 'penutup-2');
    expect(penutup?.bullets).toHaveLength(3);
    expect(deck.find((s) => s.id === 'penutup-1')?.bullets?.[0]).toContain('Minggu');
    expect(deck[0].background).toBe(true);
  });

  it('bagian B mengikuti pola ibadah pekan ini + tugas absensi/monitoring', () => {
    const studio = studioWithRhb();
    const fgd = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema', null, null, 'MONOLOG'));
    const bMonolog = fgd.find((s) => s.id === 'b-pola');
    expect(bMonolog?.title).toContain('FGD');
    expect(bMonolog?.fields).toHaveLength(3);
    const debat = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema', null, 'Debat', 'DEBAT'));
    const bDebat = debat.find((s) => s.id.startsWith('b-pola'));
    expect(bDebat?.title).toContain('Arahan Teknis & Alur Debat Hari Minggu');
    expect(debat.filter((s) => s.id.startsWith('b-pola')).flatMap((s) => s.bullets || []).join('\n')).toContain('Absensi:');
    expect(debat.filter((s) => s.id.startsWith('b-pola')).flatMap((s) => s.bullets || []).join('\n')).toContain('Update monitoring:');
    const unknown = buildPembekalanDeck(contentFromStudio(studio, 1, '2026-09-06', 'Tema'));
    expect(unknown.find((s) => s.id === 'b-pola')?.title).toContain('FGD');
  });

  it('summarizeWeek merangkum minggu untuk konteks kesinambungan', async () => {
    const { summarizeWeek } = await import('../../server/lib/didaskalia-ai.mjs');
    const studio = studioWithRhb();
    const brief = summarizeWeek({ mentoringTheme: 'The Call to Serve' }, studio);
    expect(brief?.theme).toBe('The Call to Serve');
    expect(brief?.paths).toHaveLength(7);
    expect(brief?.paths[0]).toContain('Minggu');
    expect(summarizeWeek({}, {})).toBeNull();
  });

  it('RHB harian: cover + 5 section + penutup', () => {
    const studio = studioWithRhb();
    const deck = buildRhbDayDeck(contentFromStudio(studio, 1, '2026-09-06', ''), 3);
    expect(deck[0].kind).toBe('cover');
    expect(deck[0].kicker).toContain('Selasa');
    const sections = deck.filter((s) => s.kind === 'section');
    expect(sections).toHaveLength(5);
    expect(sections[0].title).toBe('Pengantar');
    expect(sections[4].title).toBe('Pertanyaan untuk Diskusi Kelompok');
    expect(deck[deck.length - 1].kind).toBe('closing');
  });

  it('RHB harian menampilkan Bacaan Alkitab & Nats Pembimbing', () => {
    const studio = studioWithRhb();
    const content = contentFromStudio(studio, 1, '', '');
    content.paths[1] = { ...content.paths[1], bacaanRef: '1 Timotius 3:3-4', scriptureRef: '1 Timotius 3:11' };
    const deck = buildRhbDayDeck(content, 2);
    const labels = (deck[0].fields || []).map((f) => f.label);
    expect(labels).toContain('Bacaan Alkitab');
    expect(labels).toContain('Nats Pembimbing');
  });

  it('RHB harian memakai gambar per section bila ada', () => {
    const studio = studioWithRhb();
    const content = contentFromStudio(studio, 1, '', '');
    content.images = { rhb: { '2': { PENGANTAR: 'file-abc', cover: 'file-cover' } } };
    const deck = buildRhbDayDeck(content, 2);
    expect(deck[0].imageFileId).toBe('file-cover');
    expect(deck[1].imageFileId).toBe('file-abc');
  });

  it('rhbDayList mengembalikan 7 hari', () => {
    const studio = studioWithRhb();
    const days = rhbDayList(contentFromStudio(studio, 1, '', ''));
    expect(days).toHaveLength(7);
    expect(days[0].dayLabel).toBe('Minggu');
  });
});

describe('effectiveRhbSections', () => {
  it('memakai section tersimpan bila terisi', () => {
    const p = { ...ensurePaths(defaultStudio())[0], rhbSections: ensureRhbSections([]).map((s) => (s.key === 'PENGANTAR' ? { ...s, body: 'Ada isi' } : s)) };
    expect(effectiveRhbSections(p)[0].body).toBe('Ada isi');
  });

  it('turunkan dari field lama bila kosong', () => {
    const p = { ...ensurePaths(defaultStudio())[0], hookQuestion: 'Hook lama', reflection: 'Refleksi lama' };
    const secs = effectiveRhbSections(p);
    expect(secs[0].body).toContain('Hook lama');
    expect(secs[3].body).toBe('Refleksi lama');
  });
});

describe('caption', () => {
  it('caption harian memuat link tertaut', () => {
    const studio = studioWithRhb();
    const content = contentFromStudio(studio, 1, '2026-09-06', 'Tema');
    const text = buildDayCaption({ doc: 'rhb', yearMonth: '2026-09', weekIndex: 1, dayIndex: 2, content, origin: 'https://youth.gehc.page' });
    expect(text).toContain('https://youth.gehc.page/#/materi/rhb/2026-09/1/2');
    expect(text).toContain('RHB Pekan 1');
  });

  it('caption sepekan memuat 7 link harian', () => {
    const studio = studioWithRhb();
    const content = contentFromStudio(studio, 1, '2026-09-06', 'Tema');
    const text = buildWeekCaption({ doc: 'rhb', yearMonth: '2026-09', weekIndex: 1, content, origin: 'https://youth.gehc.page' });
    for (let d = 1; d <= 7; d += 1) expect(text).toContain(`/#/materi/rhb/2026-09/1/${d}`);
  });
});
