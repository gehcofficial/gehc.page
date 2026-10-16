import { describe, expect, it } from 'vitest';
import { buildThanksCaption } from '../../src/lib/arsip-caption';

describe('arsip-caption', () => {
  it('caption lengkap: ibadah + tuan rumah & penanggung + firman + ide + link', () => {
    const out = buildThanksCaption({
      eventName: 'Ibadah Pemuda Raya',
      eventDateLabel: '11 Oktober 2026',
      eventId: 'evt-1',
      host: 'Hesed',
      responsible: 'Avodah',
      verseRef: '2 Korintus 5:21',
      bigIdea: 'Allah menyediakan rencana.',
      origin: 'https://youth.gehc.page/',
    });
    expect(out).toContain('Terima kasih Tuhan untuk ibadah "Ibadah Pemuda Raya" (11 Oktober 2026).');
    expect(out).toContain('Terima kasih tuan rumah Hesed & penanggung jawab Avodah dan semua petugas yang melayani.');
    expect(out).toContain('Firman: 2 Korintus 5:21.');
    expect(out).toContain('Allah menyediakan rencana.');
    expect(out).toContain('https://youth.gehc.page#/arsip/evt-1');
  });

  it('tanpa tuan rumah/penanggung/ayat/ide tetap rapi', () => {
    const out = buildThanksCaption({ eventName: 'Ibadah', eventDateLabel: '1 Januari 2026', eventId: 'x' });
    expect(out).toContain('Terima kasih semua petugas yang melayani.');
    expect(out).not.toContain('Firman:');
    expect(out.split('\n')).toHaveLength(2);
  });
});
