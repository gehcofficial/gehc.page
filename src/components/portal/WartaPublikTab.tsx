import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
  AlertTriangle,
  Eye,
  Send,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react';
import WartaExportModal from './WartaExportModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const WARTA_STATUS_FLOW = ['DRAFT', 'CONTENT_READY', 'COPY_EDIT', 'DESIGN', 'REVIEW', 'APPROVED', 'PUBLISHED'];

const WARTA_FIELDS = [
  { key: 'ayat', label: 'Ayat', placeholder: 'Contoh: Roma 12:1-2', rows: 1 },
  { key: 'khotbah', label: 'Khotbah', placeholder: 'Ringkasan khotbah minggu ini…', rows: 4 },
  { key: 'pengumuman', label: 'Pengumuman', placeholder: 'Pengumuman jemaat & pemuda…', rows: 3 },
  { key: 'pelayanan', label: 'Pelayanan', placeholder: 'Jadwal pelayan minggu depan…', rows: 3 },
  { key: 'sharing', label: 'Sharing', placeholder: 'Kesaksian / sharing singkat…', rows: 3 },
  { key: 'doa', label: 'Doa', placeholder: 'Pokok doa syafaat…', rows: 3 },
  { key: 'jadwal', label: 'Jadwal Minggu Depan', placeholder: 'Penanggung & tuan rumah minggu depan…', rows: 2 },
];

const FIELD_LABELS = {
  ayat: 'Ayat',
  khotbah: 'Khotbah',
  pengumuman: 'Pengumuman',
  pelayanan: 'Pelayanan',
  sharing: 'Sharing',
  doa: 'Doa',
  jadwal: 'Jadwal Minggu Depan',
};

function wartaPreview(contentJson) {
  const c = contentJson && typeof contentJson === 'object' ? contentJson : {};
  const parts = [];
  for (const f of WARTA_FIELDS) {
    const v = String(c[f.key] || '').trim();
    if (v) parts.push(`${FIELD_LABELS[f.key]}: ${v}`);
  }
  return parts.join(' · ').slice(0, 160);
}
const STATUS_LABELS = {
  DRAFT: 'Draft',
  CONTENT_READY: 'Konten Siap (Didaskalia)',
  COPY_EDIT: 'Edit Copy (Koinonia PR)',
  DESIGN: 'Desain (Marturia)',
  REVIEW: 'Review (Komisi)',
  APPROVED: 'Disetujui',
  PUBLISHED: 'Dipublikasikan',
};
const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONTENT_READY: 'bg-blue-100 text-blue-700',
  COPY_EDIT: 'bg-purple-100 text-purple-700',
  DESIGN: 'bg-pink-100 text-pink-700',
  REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
};

export default function WartaPublikTab({ division }: { division: string }) {
  const [wartaList, setWartaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWarta, setEditingWarta] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [exportWarta, setExportWarta] = useState(null);
  const [desk, setDesk] = useState<any>(null);
  const [deskBusy, setDeskBusy] = useState(false);
  const [confirmSuggest, setConfirmSuggest] = useState(false);
  /** Jadwal penanggung/tuan rumah per tanggal (bulan terlihat). */
  const [servingByDate, setServingByDate] = useState<Record<string, { responsible: string; host: string; virtual: boolean }>>({});
  /** Jumlah petugas penatalayan per tanggal (bulan terlihat). */
  const [dutyCountByDate, setDutyCountByDate] = useState<Record<string, number>>({});

  /** Ambil rangkuman jadwal pelayanan untuk tanggal warta, lalu isikan ke field terkait. */
  const fillFromDesk = useCallback(async (dateISO: string, withSuggestions: boolean) => {
    setDeskBusy(true);
    try {
      const r = await fetch(
        `/api/warta/desk?date=${encodeURIComponent(dateISO)}&suggestions=${withSuggestions ? 1 : 0}`,
        { credentials: 'include' },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat jadwal pelayanan');
      setDesk(d);
      setEditingWarta((prev: any) => (prev
        ? { ...prev, contentJson: { ...(prev.contentJson || {}), ...(d.texts || {}) } }
        : prev));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal memuat jadwal pelayanan');
    } finally {
      setDeskBusy(false);
    }
  }, []);

  const wartaDateISO = editingWarta ? String(editingWarta.weekDate || '').slice(0, 10) : '';

  // Prefill Penanggung/Tuan Rumah + jadwal minggu depan dari jadwal pelayanan
  // BILA field-nya masih kosong (tidak menimpa tulisan manual).
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!showDetail || !editingWarta || !wartaDateISO) return;
    if (prefilledFor.current === editingWarta.id) return;
    const c = editingWarta.contentJson || {};
    const missing = ['pelayanan', 'jadwal'].some((k) => !String(c[k] || '').trim());
    if (!missing) return;
    prefilledFor.current = editingWarta.id;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/warta/desk?date=${encodeURIComponent(wartaDateISO)}&suggestions=0`, { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        setDesk(d);
        setEditingWarta((prev: any) => {
          if (!prev) return prev;
          const cur = prev.contentJson || {};
          const next = { ...cur };
          for (const k of ['pelayanan', 'jadwal']) {
            if (!String(cur[k] || '').trim() && d.texts?.[k]) next[k] = d.texts[k];
          }
          return { ...prev, contentJson: next };
        });
      } catch { /* prefill opsional */ }
    })();
    return () => { cancelled = true; };
  }, [showDetail, editingWarta?.id, wartaDateISO, editingWarta]);

  const fetchWarta = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const [r, s, duty] = await Promise.all([
        fetch(`/api/warta?from=${from}&to=${to}`, { credentials: 'include' }),
        fetch(`/api/serving-assignments?from=${from}&to=${to}&includeVirtual=1`, { credentials: 'include' }),
        fetch(`/api/penatalayan/schedules?from=${from}&to=${to}`, { credentials: 'include' }).catch(() => null),
      ]);
      const d = await r.json();
      setWartaList(d.warta || []);
      if (duty?.ok) {
        const dd = await duty.json().catch(() => ({}));
        const counts: Record<string, number> = {};
        for (const row of (dd.schedules || []) as Array<{ date?: string; status?: string }>) {
          if (String(row.status || '').toUpperCase() === 'CANCELLED') continue;
          const iso = String(row.date || '').slice(0, 10);
          if (!iso) continue;
          counts[iso] = (counts[iso] || 0) + 1;
        }
        setDutyCountByDate(counts);
      }
      if (s.ok) {
        const sd = await s.json();
        const rows = [...(sd.assignments || []), ...(sd.virtual || [])];
        const map: Record<string, { responsible: string; host: string; virtual: boolean }> = {};
        for (const row of rows) {
          const iso = String(row.eventDate || '').slice(0, 10);
          if (!iso) continue;
          map[iso] = {
            responsible: row.responsibleGroup?.name || row.responsibleGroupId || '—',
            host: row.hostGroup?.name || row.hostGroupId || '—',
            virtual: Boolean(row.isVirtual),
          };
        }
        setServingByDate(map);
      }
    } catch { /* skip */ }
  }, [currentMonth]);

  useEffect(() => { setLoading(true); fetchWarta().finally(() => setLoading(false)); }, [fetchWarta]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const advanceStatus = async (id: string, nextStatus: string) => {
    const r = await fetch(`/api/warta/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'Gagal ubah status');
      return;
    }
    fetchWarta();
  };

  const deleteWarta = async (id: string) => {
    if (!confirm('Hapus warta ini?')) return;
    await fetch(`/api/warta/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchWarta();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await fetch('/api/warta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        weekDate: form.get('weekDate'),
        title: form.get('title'),
      }),
    });
    setShowCreateModal(false);
    fetchWarta();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#F6AE4A]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#1B1B1B]">Warta Publik</h3>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-3 py-1 font-semibold text-sm bg-[#FAF9F5] border border-[#D9D7D0] rounded-xl">
            {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-3 py-1.5 rounded-xl text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Buat Warta
          </button>
        </div>
      </div>

      {wartaList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-8 text-center">
          <FileText className="w-10 h-10 text-[#D9D7D0] mx-auto mb-3" />
          <p className="text-sm text-[#8C8880]">Belum ada warta untuk bulan ini.</p>
          <button onClick={() => setShowCreateModal(true)} className="mt-3 text-xs font-bold text-[#F6AE4A] hover:underline">Buat warta pertama →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {wartaList.map(w => (
            <div key={w.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[w.status]}`}>
                      {STATUS_LABELS[w.status]}
                    </span>
                    <span className="text-xs text-[#8C8880]">
                      {new Date(w.weekDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  <p className="font-bold text-sm truncate">{w.title}</p>
                  {(() => {
                    const iso = String(w.weekDate || '').slice(0, 10);
                    const s = servingByDate[iso];
                    const dutyCount = dutyCountByDate[iso] || 0;
                    if (!s && !dutyCount) return null;
                    return (
                      <p className="text-[11px] text-[#5C5850] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {s && (
                          <>
                            <span>Penanggung: <strong>{s.responsible}</strong></span>
                            <span aria-hidden>⇄</span>
                            <span>Tuan Rumah: <strong>{s.host}</strong></span>
                            {s.virtual && <span className="text-[10px] text-[#8C8880] italic">(prediksi)</span>}
                          </>
                        )}
                        {dutyCount > 0 && (
                          <span className="text-teal-700 font-bold">· {dutyCount} petugas</span>
                        )}
                      </p>
                    );
                  })()}
                  {wartaPreview(w.contentJson) && (
                    <p className="text-xs text-[#8C8880] mt-1 max-h-8 overflow-hidden">
                      {wartaPreview(w.contentJson)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {w.pdfUrl && (
                    <a href={w.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl hover:bg-gray-100" title="Download PDF">
                      <Download className="w-4 h-4 text-blue-600" />
                    </a>
                  )}
                  {w.pngUrl && (
                    <a href={w.pngUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl hover:bg-gray-100" title="Lihat PNG">
                      <Eye className="w-4 h-4 text-green-600" />
                    </a>
                  )}
                  <button onClick={() => { setEditingWarta(w); setShowDetail(w.id); }} className="p-2 rounded-xl hover:bg-gray-100" title="Edit">
                    <Edit2 className="w-4 h-4 text-[#8C8880]" />
                  </button>
                  <button onClick={() => setExportWarta(w)} className="p-2 rounded-xl hover:bg-gray-100" title="Export / bagikan">
                    <Share2 className="w-4 h-4 text-[#8C8880]" />
                  </button>
                  {w.status === 'DRAFT' && (
                    <button onClick={() => deleteWarta(w.id)} className="p-2 rounded-xl hover:bg-gray-100" title="Hapus">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status flow buttons */}
              {w.status !== 'PUBLISHED' && w.status !== 'REJECTED' && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {WARTA_STATUS_FLOW
                    .filter(s => WARTA_STATUS_FLOW.indexOf(s) > WARTA_STATUS_FLOW.indexOf(w.status))
                    .slice(0, 3)
                    .map(s => (
                      <button
                        key={s}
                        onClick={() => advanceStatus(w.id, s)}
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg transition-colors ${
                          s === WARTA_STATUS_FLOW[WARTA_STATUS_FLOW.indexOf(w.status) + 1]
                            ? 'bg-[#1B1B1B] text-white'
                            : 'bg-[#FAF9F5] text-[#8C8880] hover:bg-gray-200'
                        }`}
                      >
                        {STATUS_LABELS[s].split(' ')[0]}
                      </button>
                    ))}
                </div>
              )}

              {w.status === 'REJECTED' && w.rejectReason && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-700">Ditolak: {w.rejectReason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-4">Buat Warta Baru</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Minggu Ke</label>
                <input type="date" name="weekDate" required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Judul</label>
                <input type="text" name="title" required placeholder="Contoh: Warta Minggu 7 September 2026"
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold">Buat</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail/Edit Modal */}
      {showDetail && editingWarta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowDetail(null); setEditingWarta(null); }}>
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Edit Warta</h3>
              <button onClick={() => { setShowDetail(null); setEditingWarta(null); }} className="p-2 rounded-xl hover:bg-gray-100"><XCircle className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Status</label>
                <select
                  value={editingWarta.status}
                  onChange={e => advanceStatus(editingWarta.id, e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
                >
                  {WARTA_STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Judul</label>
                <input
                  value={editingWarta.title}
                  onChange={e => { editingWarta.title = e.target.value; setEditingWarta({ ...editingWarta }); }}
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              </div>
              <div className="rounded-2xl border border-[#F6AE4A]/50 bg-[#FFF8EC] p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#B67B12]">
                  Isi otomatis dari jadwal pelayanan
                </p>
                <p className="text-[10px] text-[#8C8880]">
                  Minggu {new Date(`${wartaDateISO}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={deskBusy || !wartaDateISO}
                    onClick={() => fillFromDesk(wartaDateISO, false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-50"
                  >
                    {deskBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Isi dari jadwal
                  </button>
                  <button
                    type="button"
                    disabled={deskBusy || !wartaDateISO}
                    onClick={() => setConfirmSuggest(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[11px] font-bold disabled:opacity-50"
                  >
                    Isi + saran doa (privat)
                  </button>
                </div>
                {desk && (
                  <div className="text-[11px] text-[#5C5850] space-y-0.5 pt-1 border-t border-[#F6AE4A]/30">
                    <p>
                      Penanggung: <b>{desk.responsibleGroup?.name || '—'}</b> · Tuan Rumah: <b>{desk.hostGroup?.name || '—'}</b>
                      {desk.projected ? ' (perkiraan)' : ''}
                    </p>
                    <p>
                      Tema pekan: <b>{desk.themes?.weekTheme || '—'}</b> · Bulan: <b>{desk.themes?.monthTheme || '—'}</b>
                    </p>
                    <p>
                      Petugas: <b>{desk.officers?.length || 0}</b> komponen ·{' '}
                      <b>{desk.officers?.filter((o: any) => o.people?.length).length || 0}</b> terisi
                    </p>
                    {desk.suggestions?.length ? (
                      <p className="text-amber-700 font-bold">
                        Saran doa privat: {desk.suggestions.length} — sunting dulu sebelum terbit.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              {WARTA_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">{f.label}</label>
                  <textarea
                    value={(editingWarta.contentJson && editingWarta.contentJson[f.key]) || ''}
                    onChange={e => {
                      const contentJson = { ...(editingWarta.contentJson || {}), [f.key]: e.target.value };
                      setEditingWarta({ ...editingWarta, contentJson });
                    }}
                    rows={f.rows}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60">
                <p className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1">Pratinjau kartu landing</p>
                <p className="text-xs text-[#1B1B1B] leading-relaxed whitespace-pre-wrap">
                  {wartaPreview(editingWarta.contentJson) || 'Isi field di atas untuk pratinjau…'}
                </p>
              </div>
              {editingWarta.pdfUrl && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                  <FileText className="w-5 h-5 text-green-600" />
                  <a href={editingWarta.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 text-sm underline">PDF siap download</a>
                </div>
              )}
              {editingWarta.pngUrl && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <a href={editingWarta.pngUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 text-sm underline">PNG siap untuk sosmed</a>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowDetail(null); setEditingWarta(null); }} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Tutup</button>
                <button
                  onClick={async () => {
                    const r = await fetch(`/api/warta/${editingWarta.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ title: editingWarta.title, contentJson: editingWarta.contentJson }),
                    });
                    if (!r.ok) {
                      const d = await r.json().catch(() => ({}));
                      alert(d.error || 'Gagal menyimpan');
                      return;
                    }
                    setShowDetail(null); setEditingWarta(null); fetchWarta();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportWarta && (
        <WartaExportModal
          warta={exportWarta}
          isOpen={!!exportWarta}
          onClose={() => setExportWarta(null)}
        />
      )}

      <ConfirmDialog
        open={confirmSuggest}
        title="Sertakan saran doa dari Portal Doa?"
        confirmLabel="Ya, sertakan"
        busy={deskBusy}
        onClose={() => setConfirmSuggest(false)}
        onConfirm={() => { setConfirmSuggest(false); fillFromDesk(wartaDateISO, true); }}
        description={(
          <div className="space-y-1">
            <p>Saran doa diambil dari <b>Portal Doa</b> (data privat) dan hanya memuat <b>nama depan + jenis</b> — tanpa isi catatan.</p>
            <p className="font-bold text-amber-700">Warta tampil di halaman publik. Sunting/zamankan dulu sebelum status PUBLISHED.</p>
          </div>
        )}
      />
    </div>
  );
}