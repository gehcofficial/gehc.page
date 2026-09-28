import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChurchDutyPanel } from './ChurchDutyPanel';

type Incident = {
  id: string; title: string; category: string; severity: string; occurredAt: string;
  location?: string | null; description?: string | null; status: string; actionTaken?: string | null;
};

const SEV_STYLE: Record<string, string> = {
  RINGAN: 'bg-slate-100 text-slate-600',
  SEDANG: 'bg-amber-50 text-amber-700',
  BERAT: 'bg-rose-50 text-rose-700',
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700',
  HANDLED: 'bg-sky-50 text-sky-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

/** Panji Yosua: laporan insiden + pos jaga. */
export const ChurchSecurityPanel: React.FC = () => {
  const { addToast } = useApp();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', category: 'LAIN', severity: 'RINGAN', location: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetch('/api/church/incidents', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { incidents: [] }));
      setIncidents(Array.isArray(d?.incidents) ? d.incidents : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const report = async () => {
    if (!form.title.trim()) {
      addToast({ type: 'error', title: 'Judul insiden wajib' });
      return;
    }
    const res = await fetch('/api/church/incidents', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal melaporkan', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setForm({ title: '', category: 'LAIN', severity: 'RINGAN', location: '', description: '' });
    addToast({ type: 'success', title: 'Laporan insiden dikirim' });
    load();
  };

  const setStatus = async (i: Incident, status: string) => {
    const res = await fetch(`/api/church/incidents/${i.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal ubah status', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    load();
  };

  const fmt = (v: string) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-black uppercase tracking-wide">Keamanan (Panji Yosua)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_.8fr_1.2fr_1.6fr_auto] gap-2 items-center">
          <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Judul insiden" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} placeholder="Kategori" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <select value={form.severity} onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
            <option value="RINGAN">Ringan</option>
            <option value="SEDANG">Sedang</option>
            <option value="BERAT">Berat</option>
          </select>
          <input value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} placeholder="Lokasi" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Keterangan" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <button type="button" onClick={report} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Lapor
          </button>
        </div>
      </div>

      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wide">Laporan Insiden</h4>
        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : incidents.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada laporan.</p>
        ) : (
          incidents.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-[#EFEDE8]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{i.title}</p>
                <p className="text-[10px] text-[#8C8880]">{fmt(i.occurredAt)} · {i.category}{i.location ? ` · ${i.location}` : ''}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEV_STYLE[i.severity] || 'bg-slate-100 text-slate-600'}`}>{i.severity}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[i.status] || 'bg-slate-100 text-slate-600'}`}>{i.status}</span>
              {i.status === 'OPEN' && (
                <button type="button" onClick={() => setStatus(i, 'HANDLED')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700">Tangani</button>
              )}
              {i.status === 'HANDLED' && (
                <button type="button" onClick={() => setStatus(i, 'CLOSED')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100">Tutup</button>
              )}
            </div>
          ))
        )}
      </div>

      <ChurchDutyPanel division="PANJI" />
    </div>
  );
};

export default ChurchSecurityPanel;

