import { describe, it, expect } from 'vitest';
import { senderCapabilities, NOTIFY_CATEGORIES } from '../../server/lib/notify.mjs';

const user = (...roles: string[]) => ({ roles: roles.map((role) => ({ role })) });

describe('senderCapabilities', () => {
  it('Komisi boleh ke publik & semua kategori', () => {
    const caps = senderCapabilities(user('KOMISI'));
    expect(caps.audiences).toContain('PUBLIC');
    expect(caps.categories).toEqual(expect.arrayContaining([...NOTIFY_CATEGORIES]));
  });

  it('Mentor hanya ke kelompok/user, boleh pengumuman ke kelompoknya', () => {
    const caps = senderCapabilities(user('MENTOR'));
    expect(caps.audiences).toEqual(['GROUP', 'USER']);
    expect(caps.categories).toContain('announcement');
    expect(caps.categories).toContain('penatalayan');
  });

  it('Committee BOD (TIMKERJA) boleh ke peran, PIC dibatasi divisi', () => {
    const bod = senderCapabilities(user('COMMITTEE'), 'TIMKERJA');
    expect(bod.isBod).toBe(true);
    expect(bod.audiences).toContain('ROLE');
    expect(bod.audiences).not.toContain('PUBLIC');

    const pic = senderCapabilities(user('COMMITTEE'), 'LITURGIA');
    expect(pic.isBod).toBe(false);
    expect(pic.scopeDivision).toBe('LITURGIA');
    expect(pic.audiences).toEqual(['DIVISION', 'GROUP', 'USER']);
    expect(pic.categories).not.toContain('announcement');
  });

  it('Mentee tidak punya audiens', () => {
    const caps = senderCapabilities(user('MENTEE'));
    expect(caps.audiences).toHaveLength(0);
    expect(caps.categories).toHaveLength(0);
  });
});
