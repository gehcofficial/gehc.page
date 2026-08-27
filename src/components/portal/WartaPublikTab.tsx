import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import WartaExportModal from './WartaExportModal';

const WARTA_STATUS_FLOW = ['DRAFT', 'CONTENT_READY', 'COPY_EDIT', 'DESIGN', 'REVIEW', 'APPROVED', 'PUBLISHED'];
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

  const fetchWarta = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const r = await fetch(`/api/warta?from=${from}&to=${to}`, { credentials: 'include' });
      const d = await r.json();
      setWartaList(d.warta || []);
    } catch { /* skip */ }
  }, [currentMonth]);

  useEffect(() => { setLoading(true); fetchWarta().finally(() => setLoading(false)); }, [fetchWarta]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const advanceStatus = async (id: string, nextStatus: string) => {
    await fetch(`/api/warta/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
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
                  {w.contentJson && Object.keys(w.contentJson).length > 0 && (
                    <p className="text-xs text-[#8C8880] mt-1 max-h-8 overflow-hidden">
                      {JSON.stringify(w.contentJson).slice(0, 120)}...
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
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Konten (JSON)</label>
                <textarea
                  value={JSON.stringify(editingWarta.contentJson || {}, null, 2)}
                  onChange={e => { editingWarta.contentJson = JSON.parse(e.target.value); setEditingWarta({ ...editingWarta }); }}
                  rows={8}
                  className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm font-mono text-xs"
                  placeholder='{"khotbah": "...", "pelayanan": "...", "sharing": "..."}'
                />
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
                  onClick={() => {
                    fetch(`/api/warta/${editingWarta.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ title: editingWarta.title, contentJson: editingWarta.contentJson }),
                    }).then(() => { setShowDetail(null); setEditingWarta(null); fetchWarta(); });
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
    </div>
  );
}