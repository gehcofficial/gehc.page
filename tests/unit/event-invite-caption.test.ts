import { describe, expect, it } from 'vitest';
import { buildInviteCaption, inviteLink } from '../../src/lib/event-invite-caption';

const INPUT = {
  eventName: 'Ibadah Pemuda Mentoring',
  eventDate: '2026-10-04T06:00:00Z',
  venueName: 'GMIM Eben Haezer Cikarang',
  slug: 'ibadah-pemuda-mentoring-more-than-good-n-munvbmqezm',
  origin: 'https://youth.gehc.page',
};

describe('inviteLink', () => {
  it('link publik #/event/slug tanpa login', () => {
    expect(inviteLink(INPUT)).toBe(
      'https://youth.gehc.page/#/event/ibadah-pemuda-mentoring-more-than-good-n-munvbmqezm',
    );
  });

  it('fallback ke #/register tanpa slug', () => {
    expect(inviteLink({})).toBe('https://youth.gehc.page/#/register');
  });
});

describe('buildInviteCaption', () => {
  it('memuat link, 3 langkah, dan penegas bukan-QRIS', () => {
    const text = buildInviteCaption(INPUT);
    expect(text).toContain('#/event/ibadah-pemuda-mentoring-more-than-good-n-munvbmqezm');
    expect(text).toContain('1. Buka link di atas.');
    expect(text).toContain('2. Masuk dengan Google');
    expect(text).toContain('3. Simpan QR');
    expect(text).toContain('BUKAN QRIS');
  });

  it('memuat 4 manfaat + tanggal Indonesia', () => {
    const text = buildInviteCaption(INPUT);
    expect(text).toContain('QR daftar ulang');
    expect(text).toContain('Grup WhatsApp peserta');
    expect(text).toContain('Kehadiran tercatat');
    expect(text).toContain('Kartu terima kasih personal');
    expect(text).toContain('Oktober 2026');
    expect(text).toContain('GMIM Eben Haezer Cikarang');
  });

  it('tahan tanpa tanggal/venue/slug', () => {
    const text = buildInviteCaption({ eventName: 'Ibadah' });
    expect(text).toContain('Ibadah');
    expect(text).toContain('#/register');
  });
});
