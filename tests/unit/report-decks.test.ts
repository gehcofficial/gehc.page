import { describe, it, expect } from 'vitest';
import {
  buildBpmjDeck,
  buildFacilityDeck,
  buildKasDeck,
  buildUnitDeck,
  rupiah,
} from '../../src/lib/report-decks';

const period = { key: '2026-09', label: 'September 2026', type: 'month' as const };

describe('report-decks — kas', () => {
  it('cover + ringkasan + akun + transaksi + tanda tangan', () => {
    const slides = buildKasDeck({
      period,
      accounts: [{ code: 'KAS-JEMAAT', name: 'Kas Jemaat', unit: 'JEMAAT', kind: 'KAS_GEREJA', opening: 1000, in: 500, out: 200, balance: 1300 }],
      totals: { in: 500, out: 200, balance: 1300 },
      transactions: [{ occurredAt: '2026-09-05T00:00:00.000Z', accountName: 'Kas Jemaat', direction: 'IN', amount: 500, category: 'SEWA' }],
    });
    const ids = slides.map((s) => s.id);
    expect(ids).toEqual(['cover', 'ringkasan', 'akun', 'transaksi', 'ttd']);
    expect(slides[0].subtitle).toBe('September 2026');
    expect(slides[1].fields?.map((f) => f.value)).toContain(rupiah(1300));
  });

  it('tanpa transaksi → tetap ada cover & ringkasan', () => {
    const slides = buildKasDeck({ period, accounts: [], totals: { in: 0, out: 0, balance: 0 }, transactions: [] });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'ringkasan', 'ttd']);
  });
});

describe('report-decks — fasilitas', () => {
  it('status + pendapatan + top + daftar', () => {
    const slides = buildFacilityDeck({
      period,
      counts: [{ status: 'APPROVED', count: 2 }],
      revenue: 1_000_000,
      topFacilities: [{ name: 'Aula', count: 2 }],
      bookings: [{ title: 'Retret', facility: 'Aula', unit: 'PEMUDA', status: 'APPROVED', startAt: '2026-09-10' }],
    });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'status', 'top', 'daftar']);
    expect(slides[1].fields?.[0].value).toBe(rupiah(1_000_000));
  });
});

describe('report-decks — bpmj & unit', () => {
  it('bpmj: 5 slide dengan angka kunci', () => {
    const slides = buildBpmjDeck({
      period,
      members: { total: 267, byBipra: [{ bipra: 'PEMUDA', count: 134 }], byKolom: 5 },
      finance: { bzpPaid: 300000, cashTotal: 1300000, openFunding: 2, openBookings: 3 },
      security: { openIncidents: 1 },
      duties: { upcoming: 4 },
      campaigns: [{ title: 'BZP' }],
      recentWarta: [{ title: 'Beasiswa', status: 'PUBLISHED' }],
    });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'anggota', 'keuangan', 'operasional', 'warta']);
    expect(slides[2].fields?.map((f) => f.value)).toContain(rupiah(1300000));
  });

  it('unit: cover + profil + kas + kegiatan + petugas', () => {
    const slides = buildUnitDeck({
      period,
      unitLabel: 'Kaum Bapa',
      memberCount: 10,
      cash: [{ name: 'Kas Kaum Bapa', balance: 250000 }],
      events: [{ name: 'Persekutuan P/KB', status: 'ACTIVE', startDate: '2026-09-12' }],
      duties: [],
    });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'profil', 'kas', 'kegiatan', 'petugas']);
    expect(slides[0].title).toContain('Kaum Bapa');
    expect(slides[4].bullets?.[0]).toContain('Belum ada');
  });
});
