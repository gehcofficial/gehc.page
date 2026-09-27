import { describe, it, expect } from 'vitest';
import { bpmjSections, facilitySections, kasSections, rupiah, unitSections } from '../../server/lib/report-pdf.mjs';

const period = { key: '2026-09', label: 'September 2026', type: 'month' as const };

describe('report-pdf — section builders', () => {
  it('rupiah', () => {
    expect(rupiah(1300000)).toBe('Rp 1.300.000');
    expect(rupiah(null)).toBe('Rp 0');
  });

  it('kas: ringkasan + akun + transaksi + pengesahan', () => {
    const s = kasSections({
      period,
      accounts: [{ code: 'KAS-JEMAAT', name: 'Kas Jemaat', unit: 'JEMAAT', kind: 'KAS_GEREJA', opening: 0, in: 500, out: 200, balance: 300 }],
      totals: { in: 500, out: 200, balance: 300 },
      transactions: [{ occurredAt: '2026-09-05', accountName: 'Kas Jemaat', direction: 'IN', amount: 500, category: 'SEWA' }],
    });
    expect(s.map((x) => x.heading)).toEqual(['Ringkasan', 'Saldo per Akun', 'Transaksi', 'Pengesahan']);
    expect(s[1].table?.columns).toEqual(['Akun', 'Unit', 'Masuk', 'Keluar', 'Saldo']);
    expect(s[1].table?.rows[0][4]).toBe(rupiah(300));
    expect(s[2].table?.rows[0][2]).toBe('Masuk');
  });

  it('fasilitas: ringkasan + status + top + daftar', () => {
    const s = facilitySections({
      period,
      counts: [{ status: 'APPROVED', count: 2 }],
      revenue: 1_000_000,
      topFacilities: [{ name: 'Aula', count: 2 }],
      bookings: [{ title: 'Retret', facility: 'Aula', unit: 'PEMUDA', status: 'APPROVED', startAt: '2026-09-10' }],
    });
    expect(s.map((x) => x.heading)).toEqual(['Ringkasan', 'Booking per Status', 'Fasilitas Terpopuler', 'Daftar Booking']);
    expect(s[0].fields?.[0][1]).toBe(rupiah(1_000_000));
  });

  it('bpmj & unit', () => {
    const b = bpmjSections({
      period,
      members: { total: 267, byBipra: [{ bipra: 'PEMUDA', count: 134 }], byKolom: 5 },
      finance: { bzpPaid: 0, cashTotal: 1300000, openFunding: 0, openBookings: 0 },
      security: { openIncidents: 1 },
      duties: { upcoming: 3 },
      campaigns: [],
      recentWarta: [{ title: 'Beasiswa', status: 'PUBLISHED' }],
    });
    expect(b.map((x) => x.heading)).toContain('Keuangan & BZP');
    expect(b[1].fields?.map((f) => f[1])).toContain(rupiah(1300000));

    const u = unitSections({
      period,
      unitLabel: 'Kaum Bapa',
      memberCount: 10,
      cash: [{ name: 'Kas Kaum Bapa', balance: 250000 }],
      events: [{ name: 'Persekutuan', status: 'ACTIVE', startDate: '2026-09-12' }],
      duties: [],
    });
    expect(u.map((x) => x.heading)).toEqual(['Profil Unit', 'Kas Unit', 'Kegiatan', 'Petugas Mendatang']);
    expect(u[1].table?.rows[0]).toEqual(['Kas Kaum Bapa', rupiah(250000)]);
  });
});
