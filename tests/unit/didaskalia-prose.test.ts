import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { extractPdfText } from '../../server/lib/pdf-text.mjs';
import { parseServiceMd } from '../../server/lib/didaskalia-md.mjs';
import { buildKhutbahDeck, contentFromStudio } from '../../src/lib/didaskalia-presentation';
import { defaultStudio } from '../../src/lib/didaskalia';
import {
  formatKhutbahOutlineMd,
  isMidSentenceLineBreak,
  joinHardWrappedLines,
} from '../../src/lib/didaskalia-prose.mjs';

const PDF_WRAP_EXCERPT = [
  'Sebuah gereja dapat mempertahankan nama, gedung, tradisi, dan',
  'program-programnya, tetapi pada saat yang sama mengabaikan pesan',
  'utama',
  'yang seharusnya diberitakan. Inilah ketegangan yang membuat tema Our',
  'Roots & DNA penting untuk dibahas.',
].join('\n');

describe('joinHardWrappedLines', () => {
  it('menggabungkan potongan PDF tanpa memecah kata di tengah (utama)', () => {
    const out = joinHardWrappedLines(PDF_WRAP_EXCERPT);
    expect(out).toContain('mengabaikan pesan utama yang seharusnya');
    expect(out).not.toMatch(/\nutama\n/);
    expect(isMidSentenceLineBreak('mengabaikan pesan', 'utama')).toBe(true);
    expect(isMidSentenceLineBreak('utama', 'yang seharusnya')).toBe(true);
  });

  it('mempertahankan subheading a./1. dan jeda paragraf', () => {
    const raw = [
      'a. Masalahnya: Ketika Identitas Menjadi Pengalih Perhatian',
      'GMIM memiliki sejarah panjang dalam kesaksian Kristen di Minahasa, yang',
      'berkaitan dengan kedatangan Riedel.',
      '',
      'b. Perdebatan: Apa yang Membuat Sebuah Gereja Dikenal?',
      'Setiap gereja memiliki praktik sendiri.',
    ].join('\n');
    const out = joinHardWrappedLines(raw);
    expect(out).toMatch(/^a\. Masalahnya:/m);
    expect(out).toContain('kesaksian Kristen di Minahasa, yang berkaitan dengan kedatangan Riedel.');
    expect(out).toMatch(/\n\nb\. Perdebatan:/);
  });

  it('fixture service W4: pengantar tidak punya pecahan satu kata per baris', async () => {
    const buf = readFileSync(new URL('../fixtures/didaskalia/service-2026-10-w4.pdf', import.meta.url));
    const parsed = parseServiceMd(await extractPdfText(buf));
    const p = parsed.outline.pengantar;
    expect(p).toContain('pesan utama yang seharusnya');
    expect(p.split('\n').filter((l) => /^utama$/i.test(l.trim()))).toHaveLength(0);
  });
});

describe('formatKhutbahOutlineMd', () => {
  it('subheading dan pertanyaan retoris mendapat penanda MD tanpa mengubah kata', () => {
    const md = formatKhutbahOutlineMd([
      'a. Masalahnya: Ketika Identitas Menjadi Pengalih Perhatian',
      'Apakah kehidupan gereja kita sungguh-sungguh mencerminkan Injil yang',
      'menjadi inti identitas kita?',
      'Poin Utama bagi Anak Muda: identitas kita berakar pada Injil.',
    ].join('\n'));
    expect(md).toContain('#### a. Masalahnya');
    expect(md).toMatch(/^> Apakah kehidupan gereja/m);
    expect(md).toContain('Poin Utama bagi Anak Muda');
  });
});

describe('deck W4 tidak memecah kalimat di tengah', () => {
  it('slide outline tidak menampilkan fragmen satu kata', async () => {
    const buf = readFileSync(new URL('../fixtures/didaskalia/service-2026-10-w4.pdf', import.meta.url));
    const parsed = parseServiceMd(await extractPdfText(buf));
    const studio = defaultStudio();
    studio.sourceMd = { service: { info: parsed.info, outline: parsed.outline }, rhb: null };
    studio.sermon.outline = { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' };
    const deck = buildKhutbahDeck(contentFromStudio(studio, 4, '2026-10-25', 'Our Roots & DNA'));
    const paras = deck.flatMap((s) => s.paragraphs || []).join('\n');
    expect(paras).toContain('pesan utama yang');
    expect(paras).not.toMatch(/\nutama\n/);
    expect(paras).not.toMatch(/\nprogram-programnya,\n/);
  });
});
