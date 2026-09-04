import { describe, expect, it } from 'vitest';
import { formatBulkShareText, formatCredentialBlock } from '../../src/lib/invite-credentials';

describe('invite-credentials', () => {
  const row = {
    name: 'Ani Wijaya',
    loginUsername: 'ani.wijaya',
    tempPassword: 'GehC-abcd1234!',
    claimUrl: 'https://gehc.page/#/claim?token=abc',
  };

  it('formatCredentialBlock lists name first', () => {
    const block = formatCredentialBlock(row);
    expect(block.startsWith('Nama: Ani Wijaya')).toBe(true);
    expect(block).toContain('Username: ani.wijaya');
    expect(block).not.toContain('Khusus');
  });

  it('formatCredentialBlock can prefix a personal banner', () => {
    const block = formatCredentialBlock(row, { banner: '>>> Khusus Ani Wijaya — salin blok ini saja <<<' });
    expect(block.startsWith('>>> Khusus Ani Wijaya')).toBe(true);
  });

  it('formatBulkShareText reminds each person to copy only their name', () => {
    const text = formatBulkShareText(
      [row, { name: 'Budi Wanget', loginUsername: 'budi.wanget', tempPassword: 'GehC-ffff0000!' }],
      {
        header: 'Salin HANYA blok yang namanya sama dengan kamu.',
        bannerFor: (name) => `>>> Khusus ${name} — salin blok ini saja <<<`,
      },
    );
    expect(text.startsWith('Salin HANYA blok yang namanya sama dengan kamu.')).toBe(true);
    expect(text).toContain('===== Ani Wijaya =====');
    expect(text).toContain('===== Budi Wanget =====');
    expect(text).toContain('>>> Khusus Ani Wijaya — salin blok ini saja <<<');
    expect(text).toContain('>>> Khusus Budi Wanget — salin blok ini saja <<<');
  });
});
