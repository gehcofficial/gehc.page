import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { EventQuestion } from '../../lib/event-questions';
import { PANTATUGAS, SUB_DIVISIONS } from '../../lib/pantatugas';

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-white text-sm';

const DEFAULT_OWNER = { ownerDivision: 'KOINONIA', ownerSubdivision: 'Hubungan & Komunikasi' };

type RequestRow = {
  id: string;
  label: string;
  type: string;
  status: string;
  ownerSubdivision: string;
  reason?: string | null;
};

export const EventQuestionsBlock: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast, currentRole } = useApp();
  const isKomisi = currentRole === 'KOMISI' || currentRole === 'SUPERADMIN';
  const [bank, setBank] = useState<EventQuestion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reqForm, setReqForm] = useState({
    label: '',
    type: 'TEXT',
    options: '',
    ownerDivision: DEFAULT_OWNER.ownerDivision,
    ownerSubdivision: DEFAULT_OWNER.ownerSubdivision,
    reason: '',
  });
  const [reqBusy, setReqBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a, r] = await Promise.all([
        fetch('/api/event-questions/bank', { credentials: 'include' }).then((x) => x.json()),
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/event-questions/requests', { credentials: 'include' }).then((x) => x.json()).catch(() => ({ requests: [] })),
      ]);
      setBank(b.questions || []);
      setSelected((a.questions || []).map((q: EventQuestion) => q.id));
      setRequests(r.requests || []);
    } catch {
      setBank([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: selected }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      addToast({ type: 'success', title: 'Soal event disimpan' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal menyimpan soal', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqBusy(true);
    try {
      const options = reqForm.options.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/event-questions/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: reqForm.label,
          type: reqForm.type,
          options,
          ownerDivision: reqForm.ownerDivision,
          ownerSubdivision: reqForm.ownerSubdivision,
          reason: reqForm.reason,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mengajukan.');
      setReqForm({
        label: '',
        type: 'TEXT',
        options: '',
        ownerDivision: DEFAULT_OWNER.ownerDivision,
        ownerSubdivision: DEFAULT_OWNER.ownerSubdivision,
        reason: '',
      });
      addToast({ type: 'success', title: 'Usulan terkirim ke Komisi' });
      await load();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal mengajukan', description: err.message });
    } finally {
      setReqBusy(false);
    }
  };

  const review = async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/event-questions/requests/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal meninjau', description: d.error });
      return;
    }
    addToast({ type: 'success', title: action === 'approve' ? 'Soal disetujui' : 'Usulan ditolak' });
    await load();
  };

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-4">
      <div>
        <h3 className="text-sm font-black text-[#1B1B1B]">Pertanyaan tambahan</h3>
        <p className="text-[10px] text-[#8C8880] mt-0.5 leading-relaxed">
          Centang soal untuk event ini. Peserta boleh mengisi di Info Event; panitia mengisi dari daftar kehadiran.
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat katalog…</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {bank.map((q) => (
            <li key={q.id}>
              <label className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[#FAF9F5] text-xs">
                <input type="checkbox" className="mt-0.5" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                <span>
                  <span className="font-bold text-[#1B1B1B]">{q.label}</span>
                  <span className="block text-[10px] text-[#8C8880]">{q.ownerSubdivision} · {q.type}</span>
                </span>
              </label>
            </li>
          ))}
          {bank.length === 0 && <li className="text-xs text-[#8C8880]">Katalog kosong — jalankan migrasi DB.</li>}
        </ul>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="text-xs px-3 py-2 rounded-xl bg-[#181818] text-white font-bold disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Simpan soal'}
        </button>
      </div>

      <form onSubmit={submitRequest} className="pt-3 border-t border-[#D9D7D0] space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Request soal baru</p>
        <input className={inputClass} placeholder="Label soal" value={reqForm.label} onChange={(e) => setReqForm((f) => ({ ...f, label: e.target.value }))} required />
        <div className="grid sm:grid-cols-2 gap-2">
          <select className={inputClass} value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="TEXT">Teks</option>
            <option value="BOOLEAN">Ya/Tidak</option>
            <option value="SELECT">Pilihan</option>
            <option value="MULTI">Multi</option>
          </select>
          <select
            className={inputClass}
            value={`${reqForm.ownerDivision}::${reqForm.ownerSubdivision}`}
            onChange={(e) => {
              const [ownerDivision, ownerSubdivision] = e.target.value.split('::');
              setReqForm((f) => ({ ...f, ownerDivision, ownerSubdivision }));
            }}
            aria-label="Sub-divisi pemilik"
          >
            {PANTATUGAS.map((pillar) => (
              <optgroup key={pillar.name} label={pillar.label}>
                {(SUB_DIVISIONS[pillar.name] || []).map((sub) => (
                  <option key={`${pillar.name}-${sub.name}`} value={`${pillar.name}::${sub.name}`}>
                    {sub.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {(reqForm.type === 'SELECT' || reqForm.type === 'MULTI') && (
          <input className={inputClass} placeholder="Opsi, pisahkan koma" value={reqForm.options} onChange={(e) => setReqForm((f) => ({ ...f, options: e.target.value }))} />
        )}
        <input className={inputClass} placeholder="Alasan (opsional)" value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} />
        <button type="submit" disabled={reqBusy || !reqForm.label.trim()} className="text-xs px-3 py-2 rounded-xl border border-[#D9D7D0] font-bold disabled:opacity-40">
          {reqBusy ? 'Mengirim…' : 'Ajukan ke Komisi'}
        </button>
      </form>

      {isKomisi && requests.filter((r) => r.status === 'PENDING').length > 0 && (
        <div className="pt-3 border-t border-[#D9D7D0] space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Usulan menunggu</p>
          {requests.filter((r) => r.status === 'PENDING').map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 text-xs bg-[#FAF9F5] rounded-xl px-3 py-2">
              <div>
                <p className="font-bold text-[#1B1B1B]">{r.label}</p>
                <p className="text-[10px] text-[#8C8880]">{r.type} · {r.ownerSubdivision}{r.reason ? ` · ${r.reason}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => review(r.id, 'approve')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold">Setujui</button>
                <button type="button" onClick={() => review(r.id, 'reject')} className="px-2 py-1 rounded-lg text-[#8C8880]">Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
