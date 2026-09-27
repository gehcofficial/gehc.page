import React, { useEffect, useState } from 'react';
import { LayoutGrid, Users, Wallet, ShieldAlert, CalendarClock, Megaphone } from 'lucide-react';

type Dashboard = {
  members: { total: number; byBipra: { bipra: string | null; count: number }[]; byKolom: number };
  finance: { bzpPaid: number; cashTotal: number; openFunding: number; openBookings: number };
  security: { openIncidents: number };
  duties: { upcoming: number };
  campaigns: { id: string; title: string; target: number }[];
  recentWarta: { id: string; title: string; status: string }[];
};

const rupiah = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const BIPRA: Record<string, string> = { BAPAK: 'Kaum Bapa', IBU: 'Kaum Ibu', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak' };

/** Dasbor BPMJ lintas unit. */
export const BpmjDashboardPanel: React.FC = () => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/church/bpmj/dashboard', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-[#8C8880]">Memuat dasbor…</p>;
  if (!data) return <p className="text-xs text-[#8C8880]">Dasbor hanya untuk BPMJ/Komisi/Superadmin.</p>;

  const cards = [
    { icon: Users, label: 'Anggota jemaat', value: String(data.members.total), sub: `${data.members.byKolom} kolom terisi` },
    { icon: Wallet, label: 'Saldo kas', value: rupiah(data.finance.cashTotal), sub: `BZP lunas ${rupiah(data.finance.bzpPaid)}` },
    { icon: LayoutGrid, label: 'Booking & dana aktif', value: `${data.finance.openBookings} / ${data.finance.openFunding}`, sub: 'fasilitas / pengajuan' },
    { icon: ShieldAlert, label: 'Insiden terbuka', value: String(data.security.openIncidents), sub: 'Panji Yosua' },
    { icon: CalendarClock, label: 'Petugas mendatang', value: String(data.duties.upcoming), sub: 'jadwal penatalayanan' },
    { icon: Megaphone, label: 'Campaign aktif', value: String(data.campaigns.length), sub: 'BZP' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wide">Dasbor BPMJ — lintas unit</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {cards.map((c) => (
            <div key={c.label} className="p-4 rounded-2xl border border-[#EFEDE8]">
              <c.icon className="w-4 h-4 text-[#FF416C]" />
              <p className="text-[10px] text-[#8C8880] mt-2">{c.label}</p>
              <p className="text-lg font-black">{c.value}</p>
              <p className="text-[10px] text-[#8C8880]">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wide">Anggota per BIPRA</h4>
          {data.members.byBipra.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Belum ada data.</p>
          ) : (
            data.members.byBipra.map((r) => (
              <div key={String(r.bipra)} className="flex items-center justify-between text-xs p-2 rounded-xl border border-[#EFEDE8]">
                <span>{BIPRA[r.bipra || ''] || r.bipra || 'Belum ditempatkan'}</span>
                <span className="font-bold">{r.count}</span>
              </div>
            ))
          )}
        </div>

        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wide">Info &amp; Peluang terbaru</h4>
          {data.recentWarta.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Belum ada warta.</p>
          ) : (
            data.recentWarta.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs p-2 rounded-xl border border-[#EFEDE8]">
                <span className="truncate">{w.title}</span>
                <span className="text-[10px] text-[#8C8880]">{w.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BpmjDashboardPanel;
