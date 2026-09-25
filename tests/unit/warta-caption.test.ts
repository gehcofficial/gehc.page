import { describe, expect, it } from 'vitest';
import { buildWartaCaption, wartaAbsoluteUrl } from '../../src/lib/warta-caption';

const base = {
  id: 'iw-1',
  title: 'Peluang Beasiswa Korsel',
  category: 'BEASISWA',
  summary: 'Beasiswa S2 ke Korea Selatan.',
  deadline: '2026-11-30',
  share: { name: 'Clay Langi' },
  shareNote: 'Penerima Beasiswa 2026',
  link: 'https://graduate.korea.ac.kr',
};

describe('caption warta (Info & Peluang)', () => {
  it('membuat caption otomatis lengkap', () => {
    const text = buildWartaCaption(base, { origin: 'https://youth.gehc.page', ns: 'superadmin' });
    expect(text).toContain('*Peluang Beasiswa Korsel*');
    expect(text).toContain('Beasiswa');
    expect(text).toContain('Beasiswa S2 ke Korea Selatan.');
    expect(text).toContain('Ditutup:');
    expect(text).toContain('Clay Langi');
    expect(text).toContain('Penerima Beasiswa 2026');
    expect(text).toContain('https://youth.gehc.page/#/portal/superadmin/internal-warta?item=iw-1');
    expect(text).toContain('#InfoPeluang');
  });

  it('caption kustom menimpa caption otomatis', () => {
    const text = buildWartaCaption({ ...base, caption: 'Teks kustom saya' }, { origin: 'https://x', ns: 'n' });
    expect(text).toBe('Teks kustom saya');
  });

  it('wartaAbsoluteUrl membentuk tautan portal dengan ns', () => {
    expect(wartaAbsoluteUrl('abc', { origin: 'https://youth.gehc.page', ns: 'mentee' }))
      .toBe('https://youth.gehc.page/#/portal/mentee/internal-warta?item=abc');
  });
});
