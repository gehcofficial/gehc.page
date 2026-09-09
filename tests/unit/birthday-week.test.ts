import { describe, expect, it } from 'vitest';
import {
  birthdayOffsetInWeek,
  birthdaysThisWeek,
  mondayOfWeek,
  renderBirthdayCaption,
  todayWibKey,
} from '../../server/lib/birthday-week.mjs';

// Rabu 9 Sep 2026 10:00 WIB.
const NOW = new Date('2026-09-09T03:00:00Z');

describe('todayWibKey', () => {
  it('tengah malam WIB ikut hari baru (bukan UTC)', () => {
    // 00:30 WIB 9 Sep = 17:30 UTC 8 Sep.
    expect(todayWibKey(new Date('2026-09-08T17:30:00Z'))).toBe('2026-09-09');
    expect(todayWibKey(NOW)).toBe('2026-09-09');
  });

  it('Senin dari minggu berjalan', () => {
    expect(mondayOfWeek('2026-09-09')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-07')).toBe('2026-09-07');
    expect(mondayOfWeek('2026-09-13')).toBe('2026-09-07');
    // Lintas tahun: Kamis 1 Jan 2026 → Senin 29 Des 2025.
    expect(mondayOfWeek('2026-01-01')).toBe('2025-12-29');
  });
});

describe('birthdaysThisWeek', () => {
  const users = [
    { id: 'a', name: 'Senin Lalu', avatar: null, birthDate: '2000-09-07' },
    { id: 'b', name: 'Hari Ini', avatar: null, birthDate: '2005-09-09' },
    { id: 'c', name: 'Minggu Nanti', avatar: null, birthDate: '2010-09-13' },
    { id: 'd', name: 'Senin Depan', avatar: null, birthDate: '2012-09-14' },
    { id: 'e', name: 'Tanpa Tanggal', avatar: null, birthDate: null },
  ];

  it('Senin–Minggu berjalan, hari lewat ikut tampil', () => {
    const r = birthdaysThisWeek(users, NOW);
    expect(r.weekStart).toBe('2026-09-07');
    expect(r.weekEnd).toBe('2026-09-13');
    expect(r.birthdays.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(r.birthdays.find((x) => x.id === 'a')?.daysToBirthday).toBe(-2);
    expect(r.birthdays.find((x) => x.id === 'b')?.daysToBirthday).toBe(0);
    expect(r.todayCount).toBe(1);
  });

  it('umur dihitung per tahun berjalan', () => {
    const r = birthdaysThisWeek(users, NOW);
    // Lahir Sep 2005, hari ini 9 Sep 2026 → 21.
    expect(r.birthdays.find((x) => x.id === 'b')?.age).toBe(21);
  });

  it('29 Feb dirayakan 28 Feb non-kabisat', () => {
    // Minggu 23 Feb – 1 Mar 2026 (2026 non-kabisat).
    const fri = new Date('2026-02-27T03:00:00Z');
    const r = birthdaysThisWeek(
      [{ id: 'k', name: 'Kabisat', avatar: null, birthDate: '2004-02-29' }],
      fri,
    );
    expect(r.weekStart).toBe('2026-02-23');
    expect(r.birthdays.map((x) => x.id)).toEqual(['k']);
  });

  it('29 Feb cocok 29 Feb tahun kabisat', () => {
    // 24–28 Feb 2020? Ambil minggu 24 Feb 2020 (Senin) — 2020 kabisat.
    const wed = new Date('2020-02-26T03:00:00Z');
    const r = birthdaysThisWeek(
      [{ id: 'k', name: 'Kabisat', avatar: null, birthDate: '2004-02-29' }],
      wed,
    );
    expect(r.birthdays.map((x) => x.id)).toEqual(['k']);
  });
});

describe('birthdayOffsetInWeek', () => {
  it('di luar minggu → -1', () => {
    expect(birthdayOffsetInWeek(9, 14, '2026-09-07')).toBe(-1);
    expect(birthdayOffsetInWeek(9, 10, '2026-09-07')).toBe(3);
  });
});

describe('renderBirthdayCaption', () => {
  it('ganti {nama} nama depan dan {umur}', () => {
    expect(renderBirthdayCaption('Halo {nama}, {umur} th!', { name: 'Budi Santoso', age: 17 })).toBe(
      'Halo Budi, 17 th!',
    );
  });

  it('default bila kosong', () => {
    expect(renderBirthdayCaption('', { name: '', age: null })).toContain('Jemaat');
  });
});
