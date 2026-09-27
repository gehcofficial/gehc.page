import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarPlus, Check, X, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { currentPeriodKeys } from '../../lib/report-routing';

type Facility = { id: string; code: string; name: string; kind: string; isActive: boolean; hourlyRate?: number | null; dailyRate?: number | null };
type Booking = {
  id: string; title: string; status: string; startAt: string; endAt: string; unit: string;
  rateAmount?: number | null; invoiceNo?: string | null; paidAt?: string | null;
  requesterUserId: string; facility?: { name?: string };
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  DONE: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
  DRAFT: 'bg-slate-100 text-slate-600',
};

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Fasilitas & penyewaan: katalog, pengajuan, dan persetujuan. */
export const ChurchFacilitiesPanel: React.FC = () => {
  const { currentRole, addToast } = useApp();
  const canManage = ['SUPERADMIN', 'BPMJ'].includes(currentRole);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ facilityId: '', title: '', purpose: '', startAt: '', endAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [f, b] = await Promise.all([
        fetch('/api/church/facilities?active=1', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/church/bookings', { credentials: 'include' }).then((r) => r.json()),
      ]);
      setFacilities(Array.isArray(f?.facilities) ? f.facilities : []);
      setBookings(Array.isArray(b?.bookings) ? b.bookings : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.facilityId || !form.title || !form.startAt || !form.endAt) {
      addToast({ type: 'error', title: 'Lengkapi fasilitas, judul, mulai & selesai' });
      return;
    }
    const res = await fetch('/api/church/bookings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal mengajukan', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setForm({ facilityId: '', title: '', purpose: '', startAt: '', endAt: '' });
    addToast({ type: 'success', title: 'Pengajuan dikirim' });
    load();
  };

  const act = async (b: Booking, body: Record<string, unknown>, label: string) => {
    const res = await fetch(`/api/church/bookings/${b.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: `Gagal ${label}`, description: (await res.json().catch(() => ({}))).error });
      return;
    }
    addToast({ type: 'success', title: `Booking ${label}` });
    load();
  };

  const pending = useMemo(() => bookings.filter((b) => b.status === 'SUBMITTED').length, [bookings]);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-sm font-black uppercase tracking-wide">Fasilitas &amp; Penyewaan</h3>
          {pending > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{pending} menunggu</span>}
          {canManage && (
            <a
              href={`#/laporan/fasilitas/${currentPeriodKeys().month}`}
              className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700"
            >
              Laporan (presentasi)
            </a>
          )}
          {canManage && (
            <a
              href="/api/church/reports/bookings.csv"
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#181818] text-white"
            >
              Unduh CSV booking
            </a>
          )}
          {canManage && (
            <a
              href={`/api/church/reports/fasilitas.pdf?period=${currentPeriodKeys().month}`}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700"
            >
              PDF
            </a>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : facilities.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada fasilitas terdaftar.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {facilities.map((f) => (
              <span key={f.id} className="px-3 py-1.5 rounded-full bg-[#F3F1EC] text-xs font-bold">
                {f.name} <span className="opacity-60">· {f.kind}</span>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] gap-2 items-center pt-2 border-t border-[#EFEDE8]">
          <select
            value={form.facilityId}
            onChange={(e) => setForm((s) => ({ ...s, facilityId: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
          >
            <option value="">Pilih fasilitas…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Keperluan/Judul" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((s) => ({ ...s, startAt: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input type="datetime-local" value={form.endAt} onChange={(e) => setForm((s) => ({ ...s, endAt: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <button type="button" onClick={submit} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold">
            <CalendarPlus className="w-3.5 h-3.5" /> Ajukan
          </button>
        </div>
      </div>

      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wide">Daftar Booking</h4>
        {bookings.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada booking.</p>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-[#EFEDE8]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{b.title}</p>
                <p className="text-[10px] text-[#8C8880]">
                  {b.facility?.name || '—'} · {fmt(b.startAt)} → {fmt(b.endAt)} · {b.unit}
                  {b.invoiceNo ? ` · ${b.invoiceNo}` : ''}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
              {canManage && b.status === 'SUBMITTED' && (
                <>
                  <button type="button" onClick={() => act(b, { status: 'APPROVED' }, 'disetujui')} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50" title="Setujui">
                    <Check className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => act(b, { status: 'REJECTED' }, 'ditolak')} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" title="Tolak">
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              {canManage && b.status === 'APPROVED' && !b.invoiceNo && (
                <button type="button" onClick={() => act(b, { issueInvoice: true }, 'invoice dibuat')} className="p-1.5 rounded-lg text-[#1B1B1B] hover:bg-[#F3F1EC]" title="Terbitkan invoice">
                  <FileText className="w-4 h-4" />
                </button>
              )}
              {canManage && b.status === 'APPROVED' && (
                <>
                  <button type="button" onClick={() => act(b, { status: 'DONE' }, 'selesai')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100">
                    Selesai
                  </button>
                  <button type="button" onClick={() => act(b, { markPaid: true }, 'lunas')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    Tandai lunas
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChurchFacilitiesPanel;
