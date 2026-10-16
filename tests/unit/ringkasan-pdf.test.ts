import { describe, expect, it } from 'vitest';
import { buildRingkasanPdf } from '../../src/lib/ringkasanPdf';

const base = {
  title: 'Ibadah Pemuda Raya: The Rescue Plan',
  dateLabel: '11 Oktober 2026',
  bigIdea: 'Allah menyediakan **rencana** penyelamatan.',
  verseRef: '2 Korintus 5:21',
  verseText: 'Dia yang tidak mengenal dosa...',
  sections: [
    { label: 'Pengantar', body: 'Halo *dunia*.' },
    { label: 'Kesimpulan', body: '' },
  ],
  duties: [{ name: 'Hesed', role: 'Tuan Rumah', division: 'KOINONIA' }],
  link: 'https://youth.gehc.page/#/arsip/x',
};

describe('ringkasanPdf', () => {
  it('menghasilkan blob PDF + nama file slug', () => {
    const out = buildRingkasanPdf(base);
    expect(out.filename).toMatch(/^ringkasan-.*\.pdf$/);
    expect(out.blob).toBeInstanceOf(Blob);
    expect(out.blob.size).toBeGreaterThan(1000);
    expect(out.blob.type).toBe('application/pdf');
  });

  it('tanpa cover dan tanpa ayat tetap jadi', () => {
    const out = buildRingkasanPdf({ title: 'Tanpo', sections: [{ label: 'Isi', body: 'x'.repeat(5000) }] });
    expect(out.blob.size).toBeGreaterThan(1000);
  });

  it('cover rusak tidak menggagalkan PDF', () => {
    const out = buildRingkasanPdf({ ...base, coverDataUrl: 'data:image/jpeg;base64,BROKEN' });
    expect(out.blob).toBeInstanceOf(Blob);
  });
});
