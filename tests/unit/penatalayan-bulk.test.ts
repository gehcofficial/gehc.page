import { describe, expect, it } from 'vitest';
import {
  MAX_BULK_ROWS,
  buildAssignments,
  formatDayID,
  rowKey,
  summarizeByUser,
} from '../../server/lib/penatalayan-bulk.mjs';

describe('buildAssignments', () => {
  it('cross-product komponen × orang × tanggal', () => {
    const { rows, total, overCap } = buildAssignments({
      roleIds: ['r1', 'r2'],
      userIds: ['u1', 'u2', 'u3'],
      dates: ['2026-09-27', '2026-10-04'],
    });
    expect(overCap).toBe(false);
    expect(total).toBe(12);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ serviceRoleId: 'r1', userId: 'u1', date: '2026-09-27' });
    // setiap kombinasi unik
    expect(new Set(rows.map((r) => rowKey(r.serviceRoleId, r.userId, r.date))).size).toBe(12);
  });

  it('dedupe input ganda & buang tanggal tidak valid', () => {
    const { rows, total } = buildAssignments({
      roleIds: ['r1', 'r1'],
      userIds: ['u1', 'u1'],
      dates: ['2026-09-27', '2026-09-27', 'bukan-tanggal'],
    });
    expect(total).toBe(1);
    expect(rows).toEqual([{ serviceRoleId: 'r1', userId: 'u1', date: '2026-09-27' }]);
  });

  it('menolak bila melewati batas baris', () => {
    const roleIds = Array.from({ length: 6 }, (_, i) => `r${i}`);
    const userIds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const dates = Array.from({ length: 5 }, (_, i) => `2026-1${i % 9}-01`);
    const res = buildAssignments({ roleIds, userIds, dates });
    expect(res.total).toBe(600);
    expect(res.total).toBeGreaterThan(MAX_BULK_ROWS);
    expect(res.overCap).toBe(true);
    expect(res.rows).toEqual([]);
  });

  it('kosong → total 0 tanpa error', () => {
    expect(buildAssignments({}).total).toBe(0);
    expect(buildAssignments({ roleIds: ['r1'] }).rows).toEqual([]);
  });
});

describe('summarizeByUser', () => {
  const roleNames = { r1: 'Liturgist', r2: 'Doa Syafaat' };

  it('satu pesan per orang berisi komponen + tanggal', () => {
    const rows = [
      { serviceRoleId: 'r1', userId: 'u1', date: '2026-09-27' },
      { serviceRoleId: 'r2', userId: 'u1', date: '2026-09-27' },
      { serviceRoleId: 'r1', userId: 'u2', date: '2026-10-04' },
    ];
    const out = summarizeByUser(rows, { roleNames });
    expect(out).toHaveLength(2);
    const u1 = out.find((x) => x.userId === 'u1');
    expect(u1?.count).toBe(2);
    expect(u1?.message).toContain('Liturgist (27 Sep)');
    expect(u1?.message).toContain('Doa Syafaat (27 Sep)');
    const u2 = out.find((x) => x.userId === 'u2');
    expect(u2?.message).toContain('4 Okt');
  });

  it('memotong daftar panjang', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ serviceRoleId: 'r1', userId: 'u1', date: `2026-09-0${i + 1}` }));
    const out = summarizeByUser(rows, { roleNames, maxItems: 2 });
    expect(out[0].count).toBe(6);
    expect(out[0].message).toContain('+4 lain');
  });

  it('label komponen tak dikenal tetap aman', () => {
    const out = summarizeByUser([{ serviceRoleId: 'zzz', userId: 'u1', date: '2026-09-27' }], { roleNames });
    expect(out[0].message).toContain('Petugas');
  });
});

describe('formatDayID', () => {
  it('tanggal ISO → label pendek Indonesia', () => {
    expect(formatDayID('2026-09-27')).toBe('27 Sep');
    expect(formatDayID('nope')).toBe('');
  });

  it('menerima Date (hasil Prisma @db.Date)', () => {
    expect(formatDayID(new Date('2026-09-27T00:00:00Z'))).toBe('27 Sep');
    expect(rowKey('r1', 'u1', new Date('2026-09-27T00:00:00Z'))).toBe('r1|u1|2026-09-27');
  });
});
