import { describe, expect, it } from 'vitest';
import {
  displayName,
  firstNameOnly,
  formatBirthdayList,
  formatDayMonth,
  formatDayShort,
  formatPrayerList,
  prayerKindLabel,
} from '../../src/lib/mask';

describe('firstNameOnly / displayName', () => {
  it('ambil nama depan', () => {
    expect(firstNameOnly('Glenity Siauw')).toBe('Glenity');
    expect(firstNameOnly('  ')).toBe('');
    expect(displayName(null)).toBe('—');
    expect(displayName('Budi Santoso', true)).toBe('Budi');
    expect(displayName('Budi Santoso', false)).toBe('Budi Santoso');
  });

  it('label jenis doa', () => {
    expect(prayerKindLabel('SAKIT')).toBe('Sakit');
    expect(prayerKindLabel('UMUM')).toBe('Umum');
    expect(prayerKindLabel('BARU')).toBe('BARU');
  });
});

describe('format tanggal', () => {
  it('tidak bergeser sehari (UTC)', () => {
    expect(formatDayShort('2026-09-03')).toContain('3');
    expect(formatDayShort('2026-09-03')).toContain('2026');
    expect(formatDayMonth('2026-09-03')).toBe('3 Sep');
    expect(formatDayShort('')).toBe('');
    expect(formatDayShort('3-9-2026')).toBe('');
  });
});

describe('formatPrayerList', () => {
  const items = [
    {
      kind: 'SAKIT',
      note: 'Doakan pemulihan setelah operasi.',
      subject: { name: 'Budi Santoso' },
      occurredOn: '2026-09-03',
      lateRecordedDays: 3,
      prayedThisWeek: true,
    },
    { kind: 'UMUM', note: 'Doa syukur jemaat.', occurredOn: '2026-09-04' },
  ];

  it('menyertakan jenis, nama, dan catatan', () => {
    const text = formatPrayerList(items, { title: 'DOA MINGGU — 13 Sep 2026' });
    expect(text).toContain('DOA MINGGU');
    expect(text).toContain('[Sakit] Budi Santoso');
    expect(text).toContain('kejadian 3 Sep 2026');
    expect(text).toContain('baru dicatat H+3');
    expect(text).toContain('sudah didoakan');
    expect(text).toContain('Doakan pemulihan');
    expect(text).toContain('[Umum] —');
    expect(text).toContain('Doa syukur jemaat.');
  });

  it('mode sembunyi detail: nama depan saja & tanpa catatan', () => {
    const text = formatPrayerList(items, { hideDetail: true });
    expect(text).toContain('[Sakit] Budi');
    expect(text).not.toContain('Budi Santoso');
    expect(text).not.toContain('Doakan pemulihan');
    expect(text).not.toContain('Doa syukur jemaat.');
  });

  it('daftar kosong diberi keterangan', () => {
    expect(formatPrayerList([], {})).toContain('belum ada konteks doa');
  });
});

describe('formatBirthdayList', () => {
  const items = [
    { name: 'Glenity Siauw', day: 3, age: 25 },
    { name: 'Budi Santoso', day: 17, age: 21 },
  ];

  it('menyertakan umur bila detail ditampilkan', () => {
    const text = formatBirthdayList(items, { title: 'ULANG TAHUN JEMAAT', monthLabel: 'September 2026' });
    expect(text).toContain('1. Glenity Siauw (25 th) — 3');
    expect(text).toContain('2. Budi Santoso (21 th) — 17');
  });

  it('mode sembunyi detail: nama depan, tanpa umur', () => {
    const text = formatBirthdayList(items, { hideDetail: true });
    expect(text).toContain('1. Glenity — 3');
    expect(text).not.toContain('25 th');
    expect(text).not.toContain('Siauw');
  });

  it('daftar kosong diberi keterangan', () => {
    expect(formatBirthdayList([], {})).toContain('belum ada ulang tahun');
  });
});
