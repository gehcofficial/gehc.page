/**
 * P6 — Penyusun slide laporan (murni). Dipakai ReportPresentation.
 */

export type ReportSlide = {
  id: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: string[];
  fields?: { label: string; value: string }[];
  callout?: { label: string; value: string };
};

export const rupiah = (n: number | string | null | undefined) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export type PeriodInfo = { key: string; label: string; type: 'month' | 'week' };

export type KasReport = {
  period: PeriodInfo;
  accounts: { code: string; name: string; unit: string; kind: string; opening: number; in: number; out: number; balance: number }[];
  totals: { in: number; out: number; balance: number };
  transactions: { occurredAt: string; accountName?: string; direction: string; amount: number; category: string; unit?: string | null; description?: string | null }[];
};

export type FacilityReport = {
  period: PeriodInfo;
  counts: { status: string; count: number }[];
  revenue: number;
  topFacilities: { name: string; count: number }[];
  bookings: { title: string; facility?: string; unit: string; status: string; startAt: string; rateAmount?: number | null }[];
};

export type BpmjReport = {
  period: PeriodInfo;
  members: { total: number; byBipra: { bipra: string | null; count: number }[]; byKolom: number };
  finance: { bzpPaid: number; cashTotal: number; openFunding: number; openBookings: number };
  security: { openIncidents: number };
  duties: { upcoming: number };
  campaigns: { title: string }[];
  recentWarta: { title: string; status: string }[];
};

export type UnitReport = {
  period: PeriodInfo;
  unitLabel: string;
  memberCount: number;
  cash: { name: string; balance: number }[];
  events: { name: string; status: string; startDate?: string | null }[];
  duties: { role?: string; user?: string; date: string; status: string }[];
};

const BIPRA_LABEL: Record<string, string> = {
  BAPAK: 'Kaum Bapa',
  IBU: 'Kaum Ibu',
  PEMUDA: 'Pemuda',
  REMAJA: 'Remaja',
  ANAK: 'Anak',
};

function cover(kindLabel: string, p: PeriodInfo, extra?: string): ReportSlide {
  return {
    id: 'cover',
    kicker: 'GMIM Eben Haezer Cikarang',
    title: kindLabel,
    subtitle: p.label,
    paragraphs: extra ? [extra] : undefined,
    callout: { label: 'Periode', value: p.label },
  };
}

export function buildKasDeck(r: KasReport): ReportSlide[] {
  const slides: ReportSlide[] = [cover('Laporan Kas', r.period)];
  slides.push({
    id: 'ringkasan',
    kicker: r.period.label,
    title: 'Ringkasan Kas',
    fields: [
      { label: 'Total Masuk', value: rupiah(r.totals.in) },
      { label: 'Total Keluar', value: rupiah(r.totals.out) },
      { label: 'Saldo', value: rupiah(r.totals.balance) },
    ],
  });
  if (r.accounts.length) {
    slides.push({
      id: 'akun',
      title: 'Saldo per Akun',
      bullets: r.accounts.map((a) => `${a.name} (${a.unit}) — ${rupiah(a.balance)}`),
    });
  }
  if (r.transactions.length) {
    slides.push({
      id: 'transaksi',
      title: 'Transaksi',
      bullets: r.transactions
        .slice(0, 20)
        .map((t) => `${String(t.occurredAt).slice(0, 10)} · ${t.accountName || ''} · ${t.direction === 'IN' ? '+' : '−'}${rupiah(t.amount)} · ${t.category}`),
    });
  }
  slides.push({ id: 'ttd', title: 'Disahkan', fields: [{ label: 'Bendahara', value: '________________' }, { label: 'Ketua BPMJ', value: '________________' }] });
  return slides;
}

export function buildFacilityDeck(r: FacilityReport): ReportSlide[] {
  const slides: ReportSlide[] = [cover('Laporan Fasilitas & Penyewaan', r.period)];
  slides.push({
    id: 'status',
    title: 'Booking per Status',
    bullets: r.counts.length ? r.counts.map((c) => `${c.status}: ${c.count}`) : ['Belum ada booking.'],
    fields: [{ label: 'Pendapatan Sewa', value: rupiah(r.revenue) }],
  });
  if (r.topFacilities.length) {
    slides.push({ id: 'top', title: 'Fasilitas Terpopuler', bullets: r.topFacilities.map((f) => `${f.name}: ${f.count} booking`) });
  }
  if (r.bookings.length) {
    slides.push({
      id: 'daftar',
      title: 'Daftar Booking',
      bullets: r.bookings
        .slice(0, 20)
        .map((b) => `${String(b.startAt).slice(0, 10)} · ${b.facility || ''} · ${b.title} (${b.unit}) — ${b.status}`),
    });
  }
  return slides;
}

export function buildBpmjDeck(r: BpmjReport): ReportSlide[] {
  return [
    cover('Laporan BPMJ — Lintas Unit', r.period),
    {
      id: 'anggota',
      title: 'Anggota Jemaat',
      fields: [{ label: 'Total', value: String(r.members.total) }, { label: 'Kolom terisi', value: String(r.members.byKolom) }],
      bullets: r.members.byBipra.map((b) => `${BIPRA_LABEL[b.bipra || ''] || b.bipra || 'Belum ditempatkan'}: ${b.count}`),
    },
    {
      id: 'keuangan',
      title: 'Keuangan & BZP',
      fields: [
        { label: 'Saldo kas', value: rupiah(r.finance.cashTotal) },
        { label: 'BZP lunas', value: rupiah(r.finance.bzpPaid) },
        { label: 'Booking aktif', value: String(r.finance.openBookings) },
        { label: 'Pengajuan aktif', value: String(r.finance.openFunding) },
      ],
    },
    {
      id: 'operasional',
      title: 'Operasional',
      fields: [
        { label: 'Insiden terbuka', value: String(r.security.openIncidents) },
        { label: 'Petugas mendatang', value: String(r.duties.upcoming) },
        { label: 'Campaign aktif', value: String(r.campaigns.length) },
      ],
    },
    { id: 'warta', title: 'Info & Peluang Terbaru', bullets: r.recentWarta.length ? r.recentWarta.map((w) => `${w.title} (${w.status})`) : ['Belum ada warta.'] },
  ];
}

export function buildUnitDeck(r: UnitReport): ReportSlide[] {
  return [
    cover(`Laporan Unit — ${r.unitLabel}`, r.period),
    { id: 'profil', title: 'Profil Unit', fields: [{ label: 'Unit', value: r.unitLabel }, { label: 'Anggota', value: String(r.memberCount) }] },
    {
      id: 'kas',
      title: 'Kas Unit',
      bullets: r.cash.length ? r.cash.map((c) => `${c.name}: ${rupiah(c.balance)}`) : ['Belum ada akun kas unit.'],
    },
    {
      id: 'kegiatan',
      title: 'Kegiatan',
      bullets: r.events.length ? r.events.map((e) => `${e.name} — ${e.status}${e.startDate ? ` · ${String(e.startDate).slice(0, 10)}` : ''}`) : ['Belum ada kegiatan.'],
    },
    {
      id: 'petugas',
      title: 'Petugas Mendatang',
      bullets: r.duties.length ? r.duties.map((d) => `${String(d.date).slice(0, 10)} · ${d.role || ''} · ${d.user || ''} (${d.status})`) : ['Belum ada jadwal petugas.'],
    },
  ];
}
