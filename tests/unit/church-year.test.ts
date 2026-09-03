import { describe, expect, it } from 'vitest';
import {
  easterSunday,
  adventSunday,
  movableFeasts,
  gmimFixedDates,
  jemaatDates,
  churchYearEntries,
  deriveSeason,
  sundaysInMonth,
  findCollisions,
  toISODate,
  utcDate,
  addDays,
  weekIndexForDate,
  yearMonthOf,
} from '../../server/lib/church-year.mjs';
import { runbookTasks, MILESTONES } from '../../server/lib/runbook-template.mjs';

const iso = (d: Date) => toISODate(d);
const byKey = <T extends { key: string }>(rows: T[], key: string): T => rows.find((r) => r.key === key)!;

describe('easterSunday (Computus)', () => {
  it('cocok dengan tanggal Paskah yang diketahui', () => {
    expect(iso(easterSunday(2026))).toBe('2026-04-05');
    expect(iso(easterSunday(2027))).toBe('2027-03-28');
    expect(iso(easterSunday(2025))).toBe('2025-04-20');
    expect(iso(easterSunday(2024))).toBe('2024-03-31');
  });
});

describe('turunan Paskah', () => {
  it('Jumat Agung 2026 jatuh 3 April', () => {
    expect(iso(byKey(movableFeasts(2026), 'JUMAT_AGUNG').date)).toBe('2026-04-03');
  });

  it('Paskah II 2026 jatuh 6 April — perayaan HUT Pemuda GMIM', () => {
    expect(iso(byKey(movableFeasts(2026), 'PASKAH_II').date)).toBe('2026-04-06');
  });

  it('Kenaikan 2026 jatuh 14 Mei dan Pentakosta 24 Mei', () => {
    expect(iso(byKey(movableFeasts(2026), 'KENAIKAN').date)).toBe('2026-05-14');
    expect(iso(byKey(movableFeasts(2026), 'PENTAKOSTA').date)).toBe('2026-05-24');
  });

  it('Rabu Abu 2026 jatuh 18 Februari', () => {
    expect(iso(byKey(movableFeasts(2026), 'RABU_ABU').date)).toBe('2026-02-18');
  });
});

describe('adventSunday', () => {
  it('Adven I 2026 jatuh 29 November', () => {
    expect(iso(adventSunday(2026, 1))).toBe('2026-11-29');
  });

  it('Adven I–IV selalu hari Minggu dan berjarak 7 hari', () => {
    for (const year of [2026, 2027, 2028]) {
      const days = [1, 2, 3, 4].map((n) => adventSunday(year, n));
      for (const d of days) expect(d.getUTCDay()).toBe(0);
      expect(days[3].getTime() - days[0].getTime()).toBe(21 * 86400000);
    }
  });
});

describe('tanggal tetap GMIM', () => {
  it('nomor peringatan 2026 sesuai fakta publik', () => {
    const rows = gmimFixedDates(2026);
    expect(byKey(rows, 'PI_MINAHASA').name).toContain('ke-195');
    expect(byKey(rows, 'GMIM_BERSINODE').name).toContain('ke-92');
    expect(byKey(rows, 'HUT_PEMUDA').name).toContain('ke-100');
    expect(byKey(rows, 'HUT_REMAJA').name).toContain('ke-36');
  });

  it('PI Minahasa 12 Juni dan Bersinode 30 September', () => {
    const rows = gmimFixedDates(2026);
    expect(iso(byKey(rows, 'PI_MINAHASA').date)).toBe('2026-06-12');
    expect(iso(byKey(rows, 'GMIM_BERSINODE').date)).toBe('2026-09-30');
  });

  it('HUT Remaja jatuh 28 Januari 2026', () => {
    expect(iso(byKey(gmimFixedDates(2026), 'HUT_REMAJA').date)).toBe('2026-01-28');
  });
});

describe('HUT Jemaat GEHC', () => {
  it('23 Maret, ke-7 pada 2026 dan ke-8 pada 2027', () => {
    expect(iso(byKey(jemaatDates(2026), 'HUT_JEMAAT').date)).toBe('2026-03-23');
    expect(byKey(jemaatDates(2026), 'HUT_JEMAAT').name).toContain('ke-7');
    expect(byKey(jemaatDates(2027), 'HUT_JEMAAT').name).toContain('ke-8');
  });

  it('2027 bertabrakan dengan Pekan Suci — Paskah 28 Maret', () => {
    const hut = byKey(jemaatDates(2027), 'HUT_JEMAAT').date;
    const palma = byKey(movableFeasts(2027), 'MINGGU_PALMA').date;
    const paskah = easterSunday(2027);
    expect(hut.getTime()).toBeGreaterThan(palma.getTime());
    expect(hut.getTime()).toBeLessThan(paskah.getTime());
  });
});

describe('deriveSeason', () => {
  it('menandai musim dari tanggal, bukan input manual', () => {
    expect(deriveSeason(utcDate(2026, 4, 5), 2026)).toBe('PASKAH');
    expect(deriveSeason(utcDate(2026, 12, 25), 2026)).toBe('NATAL');
    expect(deriveSeason(utcDate(2026, 11, 29), 2026)).toBe('NATAL');
    expect(deriveSeason(utcDate(2026, 9, 30), 2026)).toBe('HUT');
    expect(deriveSeason(utcDate(2026, 8, 10), 2026)).toBe('REGULAR');
  });
});

describe('sundaysInMonth', () => {
  it('September 2026 punya 4 hari Minggu: 6, 13, 20, 27', () => {
    expect(sundaysInMonth(2026, 9).map(iso)).toEqual([
      '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
    ]);
  });

  it('mengembalikan 5 hari Minggu saat bulannya memang punya 5', () => {
    expect(sundaysInMonth(2026, 11).map(iso)).toEqual([
      '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29',
    ]);
  });
});

describe('churchYearEntries', () => {
  it('terurut tanggal dan semua punya musim', () => {
    const rows = churchYearEntries(2026);
    expect(rows.length).toBeGreaterThan(15);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].startDate >= rows[i - 1].startDate).toBe(true);
    }
    for (const r of rows) {
      expect(['NATAL', 'PASKAH', 'HUT', 'REGULAR']).toContain(r.season);
      expect(r.source).toBeTruthy();
    }
  });

  it('mendeteksi bentrokan Paskah II dengan HUT Pemuda', () => {
    const collisions = findCollisions(churchYearEntries(2026));
    const easterMonday = collisions.find((c) => c.date === '2026-04-06');
    expect(easterMonday).toBeTruthy();
    expect(easterMonday!.entries.length).toBe(2);
  });
});

describe('weekIndexForDate', () => {
  it('memetakan tanggal ke baris minggu grid bulanan', () => {
    // September 2026: Minggu di 6, 13, 20, 27.
    expect(weekIndexForDate(utcDate(2026, 9, 1))).toBe(1); // sebelum Minggu pertama
    expect(weekIndexForDate(utcDate(2026, 9, 6))).toBe(1);
    expect(weekIndexForDate(utcDate(2026, 9, 12))).toBe(1);
    expect(weekIndexForDate(utcDate(2026, 9, 13))).toBe(2);
    expect(weekIndexForDate(utcDate(2026, 9, 27))).toBe(4);
    expect(weekIndexForDate(utcDate(2026, 9, 30))).toBe(4);
  });

  it('menangani bulan dengan 5 hari Minggu', () => {
    expect(weekIndexForDate(utcDate(2026, 11, 29))).toBe(5);
  });
});

describe('runbook H-21 → H+7', () => {
  it('setiap tonggak punya minimal satu deliverable', () => {
    const tasks = runbookTasks({ eventName: 'Natal Pemuda 2026' });
    for (const m of MILESTONES) {
      expect(tasks.some((t) => t.offset === m.offset)).toBe(true);
    }
  });

  it('judul memuat tonggak dan nama acara supaya generate ulang idempotent', () => {
    const tasks = runbookTasks({ eventName: 'Natal Pemuda 2026' });
    for (const t of tasks) {
      expect(t.title).toContain('Natal Pemuda 2026');
      expect(t.title.startsWith('[H')).toBe(true);
    }
    expect(new Set(tasks.map((t) => t.title)).size).toBe(tasks.length);
  });

  it('H-21 dari Natal 25 Des 2026 jatuh di bulan sebelumnya', () => {
    const natal = utcDate(2026, 12, 25);
    const kickoff = addDays(natal, -21);
    expect(toISODate(kickoff)).toBe('2026-12-04');
    expect(yearMonthOf(kickoff)).toBe('2026-12');

    // Adven I 29 Nov 2026 → H-21 memang lompat ke November.
    const adven = utcDate(2026, 11, 29);
    expect(yearMonthOf(addDays(adven, -21))).toBe('2026-11');
    expect(yearMonthOf(addDays(adven, 7))).toBe('2026-12');
  });

  it('hanya memakai kode divisi yang dikenal', () => {
    const known = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
    for (const t of runbookTasks({ eventName: 'X' })) {
      expect(known).toContain(t.division);
    }
  });
});
