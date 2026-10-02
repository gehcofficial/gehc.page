import { describe, expect, it } from 'vitest';
import { divisionStyleFor, roleIconName } from '../../src/components/public/DutyPersonChip';

describe('divisionStyleFor', () => {
  it('mengembalikan warna + ikon baku per divisi panca', () => {
    expect(divisionStyleFor('LITURGIA')).toMatchObject({ color: '#7C3AED', icon: 'Flame' });
    expect(divisionStyleFor('DIDASKALIA')).toMatchObject({ color: '#0EA5E9', icon: 'BookOpen' });
    expect(divisionStyleFor('KOINONIA')).toMatchObject({ color: '#059669', icon: 'Heart' });
    expect(divisionStyleFor('DIAKONIA')).toMatchObject({ color: '#EA580C', icon: 'HandHeart' });
    expect(divisionStyleFor('MARTURIA')).toMatchObject({ color: '#DC2626', icon: 'Megaphone' });
  });

  it('fallback netral untuk divisi tak dikenal', () => {
    expect(divisionStyleFor('ASING')).toMatchObject({ color: '#8C8880', icon: 'User' });
    expect(divisionStyleFor(null)).toMatchObject({ icon: 'User' });
  });
});

describe('roleIconName', () => {
  it('memetakan peran umum ke ikon spesifik', () => {
    expect(roleIconName('Worship Leader', 'LITURGIA')).toBe('Mic');
    expect(roleIconName('Singer', 'LITURGIA')).toBe('Music');
    expect(roleIconName('Pemusik — Gitar', 'LITURGIA')).toBe('Guitar');
    expect(roleIconName('Pembaca Firman 1', 'DIDASKALIA')).toBe('BookOpen');
    expect(roleIconName('Penerima Tamu / Usher', 'KOINONIA')).toBe('DoorOpen');
    expect(roleIconName('Konsumsi', 'DIAKONIA')).toBe('UtensilsCrossed');
    expect(roleIconName('Fotografer', 'MARTURIA')).toBe('Camera');
    expect(roleIconName('Koordinator Tuan Rumah', 'KOINONIA')).toBe('Users');
  });

  it('fallback ke ikon divisi bila peran tak dikenal', () => {
    expect(roleIconName('Peran Misterius', 'MARTURIA')).toBe('Megaphone');
    expect(roleIconName(null, 'DIAKONIA')).toBe('HandHeart');
  });
});
