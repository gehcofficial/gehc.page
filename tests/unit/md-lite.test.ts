import { describe, expect, it } from 'vitest';
import { extractVerseRef, parseMdLite, stripMd } from '../../src/lib/md-lite';

describe('stripMd', () => {
  it('mengupas bold/italic/code tanpa mengubah kata', () => {
    expect(stripMd('**Tuhan** baik')).toBe('Tuhan baik');
    expect(stripMd('*kasih* karunia')).toBe('kasih karunia');
    expect(stripMd('tetap `kode`')).toBe('tetap kode');
    expect(stripMd('2 * 3 = 6')).toBe('2 * 3 = 6');
  });
});

describe('extractVerseRef', () => {
  it('mendeteksi referensi ayat Indonesia', () => {
    expect(extractVerseRef('(2 Korintus 5:21)')).toBe('2 Korintus 5:21');
    expect(extractVerseRef('lihat Kolose 1:13–14 ya')).toBe('Kolose 1:13–14');
    expect(extractVerseRef('Yesaya 64:6')).toBe('Yesaya 64:6');
    expect(extractVerseRef('tanpa ayat')).toBeUndefined();
  });
});

describe('parseMdLite', () => {
  it('verbatim: kata tidak diubah, hanya struktur', () => {
    const blocks = parseMdLite('Halo **dunia** yang *baik*.\n\nBaris kedua.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'para', role: 'body' });
    expect(blocks[0]).toHaveProperty('text', 'Halo **dunia** yang *baik*.');
  });

  it('heading, divider, quote + ref ayat', () => {
    const blocks = parseMdLite('#### A. Pribadi Sempurna\n\n> *"Dia menjadi dosa"* (2 Korintus 5:21)\n\n---');
    expect(blocks[0]).toMatchObject({ kind: 'heading', text: 'A. Pribadi Sempurna' });
    expect(blocks[1]).toMatchObject({ kind: 'quote', ref: '2 Korintus 5:21' });
    expect(blocks[2]).toMatchObject({ kind: 'divider' });
  });

  it('list bullet + sarang + bernomor', () => {
    const blocks = parseMdLite('* Satu\n* Dua\n  * Sarang\n\n1. Pertama\n2. Kedua');
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: false });
    const items = (blocks[0] as { items: { text: string; level: number }[] }).items;
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ text: 'Sarang', level: 1 });
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: true });
  });

  it('peran takeaway & koreksi terdeteksi', () => {
    const [t] = parseMdLite('Poin Utama bagi Anak Muda: statusmu berubah.');
    expect(t).toMatchObject({ kind: 'para', role: 'takeaway' });
    const [c] = parseMdLite('Bukan berarti Yesus menjadi pendosa.');
    expect(c).toMatchObject({ kind: 'para', role: 'correction' });
    const [s] = parseMdLite('Kalimat biasa.', { speech: true });
    expect(s).toMatchObject({ kind: 'para', role: 'speech' });
  });

  it('tidak ada marker mentah lolos sebagai teks biasa', () => {
    const md = 'Pengantar.\n\n* **Poin:** isi.\n\n> *Kutipan* (Kolose 1:13-14)\n\n#### Sub';
    const texts = parseMdLite(md).flatMap((b) => {
      if (b.kind === 'para') return [b.text];
      if (b.kind === 'quote') return [b.text, b.ref || ''];
      if (b.kind === 'heading') return [b.text];
      if (b.kind === 'list') return b.items.map((i) => i.text);
      return [];
    }).join('\n');
    expect(texts).not.toMatch(/^#{2,4}\s/m);
    expect(texts).not.toMatch(/^>\s/m);
    expect(texts).not.toMatch(/^\*\s/m);
  });
});
