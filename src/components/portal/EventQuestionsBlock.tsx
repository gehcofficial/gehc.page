import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { EventQuestion } from '../../lib/event-questions';
import { EVENT_QUESTION_TYPES, normEventQuestionType } from '../../lib/event-questions';
import { PANTATUGAS, SUB_DIVISIONS } from '../../lib/pantatugas';

const NEEDS_OPTIONS = new Set(['DROPDOWN', 'SELECT', 'SINGLE', 'MULTI']);

type ShowIfDraft = { showKey: string; showMode: 'equals' | 'in'; showValue: string };

const EMPTY_SHOWIF: ShowIfDraft = { showKey: '', showMode: 'equals', showValue: '' };

function buildShowIf(d: ShowIfDraft) {
  const key = d.showKey.trim();
  if (!key) return null;
  if (d.showMode === 'in') {
    const vals = d.showValue.split(',').map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return null;
    return { key, in: vals };
  }
  const v = d.showValue.trim();
  if (!v) return null;
  return { key, equals: v === '__true__' ? true : v === '__false__' ? false : v };
}

function showIfToDraft(s: { key?: string; equals?: unknown; in?: unknown } | null | undefined): ShowIfDraft {
  if (!s || typeof s !== 'object' || !s.key) return { ...EMPTY_SHOWIF };
  if (Array.isArray(s.in)) {
    return {
      showKey: String(s.key),
      showMode: 'in',
      showValue: s.in.map((v) => (typeof v === 'boolean' ? (v ? '__true__' : '__false__') : String(v))).join(', '),
    };
  }
  const eq = (s as { equals?: unknown }).equals;
  return {
    showKey: String(s.key),
    showMode: 'equals',
    showValue: typeof eq === 'boolean' ? (eq ? '__true__' : '__false__') : String(eq ?? ''),
  };
}

const ShowIfPicker: React.FC<{
  bank: EventQuestion[];
  draft: ShowIfDraft;
  onChange: (d: ShowIfDraft) => void;
  excludeKey?: string;
}> = ({ bank, draft, onChange, excludeKey }) => {
  const target = bank.find((q) => q.key === draft.showKey);
  const targetBool = target && normEventQuestionType(target.type) === 'BOOLEAN';
  const mode = targetBool ? 'equals' : draft.showMode;
  const opts = bank.filter((q) => q.key !== excludeKey);
  return (
    <div className="rounded-xl border border-dashed border-[#D9D7D0] bg-[#FAF9F5] p-2 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">
        Soal ini tampil hanya jika… <span className="font-medium normal-case">(syarat dipasang di soal lanjutan, mengacu ke soal induk)</span>
      </p>
      <div className="grid sm:grid-cols-3 gap-2">
        <select
          className={inputClass}
          value={draft.showKey}
          onChange={(e) => onChange({ ...draft, showKey: e.target.value, showMode: 'equals', showValue: '' })}
          aria-label="Soal acuan"
        >
          <option value="">— Selalu tampil —</option>
          {opts.map((q) => (
            <option key={q.id} value={q.key}>{q.label}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={mode}
          onChange={(e) => onChange({ ...draft, showMode: e.target.value as 'equals' | 'in' })}
          disabled={!draft.showKey || targetBool}
          aria-label="Operator"
        >
          <option value="equals">sama dengan</option>
          <option value="in">salah satu dari</option>
        </select>
        {targetBool ? (
          <select
            className={inputClass}
            value={draft.showValue || '__true__'}
            onChange={(e) => onChange({ ...draft, showMode: 'equals', showValue: e.target.value })}
            disabled={!draft.showKey}
            aria-label="Nilai acuan"
          >
            <option value="__true__">Ya</option>
            <option value="__false__">Tidak</option>
          </select>
        ) : (
          <input
            className={inputClass}
            value={draft.showValue}
            onChange={(e) => onChange({ ...draft, showValue: e.target.value })}
            disabled={!draft.showKey}
            placeholder={mode === 'in' ? 'cth: Bekerja, Aktif Kuliah' : 'cth: Aktif Kuliah'}
            aria-label="Nilai acuan"
          />
        )}
      </div>
      {draft.showKey && target && (normEventQuestionType(target.type) === 'DROPDOWN' || normEventQuestionType(target.type) === 'SINGLE' || normEventQuestionType(target.type) === 'MULTI') && target.options.length > 0 && (
        <p className="text-[10px] text-[#8C8880]">Opsi acuan: {target.options.join(' · ')}</p>
      )}
    </div>
  );
};

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
  showIf?: { key?: string; equals?: unknown; in?: unknown } | null;
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
    type: 'SHORT_TEXT',
    options: '',
    ownerDivision: DEFAULT_OWNER.ownerDivision,
    ownerSubdivision: DEFAULT_OWNER.ownerSubdivision,
    reason: '',
  });
  const [reqShow, setReqShow] = useState<ShowIfDraft>({ ...EMPTY_SHOWIF });
  const [reqBusy, setReqBusy] = useState(false);
  // Arsip disembunyikan dari list agar "terhapus" benar-benar tidak muncul di UI.
  const [showArchived, setShowArchived] = useState(false);
  const activeBank = useMemo(() => bank.filter((q) => q.status !== 'ARCHIVED'), [bank]);
  const archivedBank = useMemo(() => bank.filter((q) => q.status === 'ARCHIVED'), [bank]);
  // Server PUT hanya menerima status ACTIVE — saring di sini agar Simpan tak pernah 400 basi.
  const selectableIds = useMemo(
    () => new Set(bank.filter((q) => (q.status || 'ACTIVE') === 'ACTIVE').map((q) => q.id)),
    [bank],
  );
  const listed = showArchived ? bank : activeBank;
  const [editing, setEditing] = useState<{ id: string; label: string; hint: string; type: string; options: string; show: ShowIfDraft; showKey: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);

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

  // Soal lanjutan per induk: soal-soal yang bersyarat pada key ini.
  const childrenByKey = useMemo(() => {
    const m = new Map<string, EventQuestion[]>();
    for (const q of bank) {
      const parent = q.showIf?.key;
      if (!parent) continue;
      const list = m.get(parent) || [];
      list.push(q);
      m.set(parent, list);
    }
    return m;
  }, [bank]);

  const condText = (s: NonNullable<EventQuestion['showIf']>) => {
    const v = Array.isArray(s.in)
      ? s.in.map((x) => (typeof x === 'boolean' ? (x ? 'Ya' : 'Tidak') : String(x))).join(' / ')
      : typeof s.equals === 'boolean'
        ? (s.equals ? 'Ya' : 'Tidak')
        : String(s.equals ?? '');
    return `= ${v}`;
  };

  // Alur yang benar: syarat dipasang di SOAL LANJUTAN, mengacu ke induk.
  // Tombol ini mengisi form request di bawah dengan acuan sudah terpasang.
  const startFollowUp = (parent: EventQuestion) => {
    setReqForm((f) => ({ ...f, label: '', type: 'SHORT_TEXT', options: '' }));
    setReqShow({ showKey: parent.key, showMode: 'equals', showValue: '' });
    addToast({ type: 'info', title: `Soal lanjutan untuk "${parent.label}"`, description: 'Isi label di form Request di bawah, syarat sudah terpasang.' });
    requestAnimationFrame(() => {
      document.getElementById('eq-request-label')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('eq-request-label')?.focus({ preventScroll: true });
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Buang ID arsip/nonaktif yang basi — tidak boleh ikut ke server.
      const clean = selected.filter((id) => selectableIds.has(id));
      if (clean.length !== selected.length) {
        setSelected(clean);
        addToast({ type: 'info', title: 'Soal arsip/nonaktif dikeluarkan dari pilihan' });
      }
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: clean }),
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
      const sentShowIf = buildShowIf(reqShow);
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
          showIf: sentShowIf,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mengajukan.');
      // Guard: API lama membuang showIf diam-diam tapi tetap 201.
      const savedShowIf = (d.request as { showIf?: unknown } | undefined)?.showIf ?? null;
      if (JSON.stringify(savedShowIf) !== JSON.stringify(sentShowIf)) {
        addToast({
          type: 'error',
          title: 'Syarat TIDAK tersimpan (API lama)',
          description: 'Restart API: stop dev:all → npx prisma generate → npm run dev:all, lalu ulangi.',
        });
        await load();
        return;
      }
      setReqForm({
        label: '',
        type: 'SHORT_TEXT',
        options: '',
        ownerDivision: DEFAULT_OWNER.ownerDivision,
        ownerSubdivision: DEFAULT_OWNER.ownerSubdivision,
        reason: '',
      });
      setReqShow({ ...EMPTY_SHOWIF });
      addToast({ type: 'success', title: 'Usulan terkirim ke Komisi' });
      await load();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal mengajukan', description: err.message });
    } finally {
      setReqBusy(false);
    }
  };

  const startEdit = (q: EventQuestion) => {
    setEditing({
      id: q.id,
      label: q.label,
      hint: q.hint || '',
      type: normEventQuestionType(q.type),
      options: (q.options || []).join(', '),
      show: showIfToDraft(q.showIf),
      showKey: q.key,
    });
  };

  const saveEdit = async () => {
    if (!editing || !editing.label.trim()) return;
    setEditBusy(true);
    try {
      const options = editing.options.split(',').map((s) => s.trim()).filter(Boolean);
      const sentShowIf = buildShowIf(editing.show);
      const res = await fetch(`/api/event-questions/bank/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editing.label.trim(),
          hint: editing.hint.trim() || null,
          type: editing.type,
          options,
          showIf: sentShowIf,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      // Guard: API lama membuang showIf diam-diam tapi tetap 200.
      // Samakan yang terkirim vs tersimpan; bila beda, peringatkan restart.
      const savedShowIf = (d.question as EventQuestion | undefined)?.showIf ?? null;
      if (JSON.stringify(savedShowIf) !== JSON.stringify(sentShowIf)) {
        addToast({
          type: 'error',
          title: 'Syarat TIDAK tersimpan (API lama)',
          description: 'Restart API: stop dev:all → npx prisma generate → npm run dev:all, lalu ulangi.',
        });
        await load();
        return;
      }
      setEditing(null);
      addToast({ type: 'success', title: 'Soal diperbarui' });
      await load();
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: err instanceof Error ? err.message : '' });
    } finally {
      setEditBusy(false);
    }
  };

  const deleteBank = async (q: EventQuestion) => {
    if (!window.confirm(`Hapus soal "${q.label}" dari bank?${q.status === 'ARCHIVED' ? '' : ' (diarsip dulu bila sudah dipakai)'}`)) return;
    try {
      const res = await fetch(`/api/event-questions/bank/${encodeURIComponent(q.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menghapus.');
      if (d.archived) {
        // Sudah dipakai → baru diarsipkan. Tawarkan hapus permanen sekalian.
        const typed = window.prompt(
          `"${q.label}" sudah dipakai event/jawaban sehingga baru DIARSIPKAN (hilang dari form, histori aman).\n\nMau HAPUS PERMANEN dari list termasuk seluruh penugasan & jawaban? Ketik persis: HAPUS\n(Kosongkan/batal = biarkan arsip.)`,
        );
        if (typed === 'HAPUS') {
          await forceDeleteBank(q, true);
          return;
        }
        addToast({ type: 'success', title: 'Soal diarsipkan (sudah dipakai)' });
      } else {
        addToast({ type: 'success', title: 'Soal dihapus' });
      }
      await load();
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal menghapus', description: err instanceof Error ? err.message : '' });
    }
  };

  const reactivateBank = async (q: EventQuestion) => {
    try {
      const res = await fetch(`/api/event-questions/bank/${encodeURIComponent(q.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengaktifkan.');
      addToast({ type: 'success', title: 'Soal aktif lagi — centang untuk event bila perlu' });
      await load();
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal mengaktifkan', description: err instanceof Error ? err.message : '' });
    }
  };

  const forceDeleteBank = async (q: EventQuestion, preConfirmed = false) => {
    if (!preConfirmed) {
      const typed = window.prompt(
        `HAPUS PERMANEN "${q.label}"?\nSeluruh penugasan event & jawaban peserta untuk soal ini ikut terhapus dan tidak bisa dikembalikan.\n\nKetik persis: HAPUS`,
      );
      if (typed !== 'HAPUS') {
        if (typed !== null) addToast({ type: 'error', title: 'Batal', description: 'Ketik tidak cocok.' });
        return;
      }
    }
    try {
      const res = await fetch(`/api/event-questions/bank/${encodeURIComponent(q.id)}?force=1`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menghapus permanen.');
      addToast({ type: 'success', title: 'Soal dihapus permanen' });
      await load();
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal menghapus', description: err instanceof Error ? err.message : '' });
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
        <>
        {isKomisi && archivedBank.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-[10px] font-bold text-[#8C8880] underline"
          >
            {showArchived ? 'Sembunyikan arsip' : `Tampilkan ${archivedBank.length} soal arsip (kelola/hapus permanen)`}
          </button>
        )}
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {listed.map((q) => (
            <li key={q.id}>
              {editing?.id === q.id ? (
                <div className="px-2 py-2 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] space-y-2">
                  <input
                    className={inputClass}
                    value={editing.label}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    placeholder="Label soal"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className={inputClass}
                      value={editing.type}
                      onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    >
                      {EVENT_QUESTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      value={editing.hint}
                      onChange={(e) => setEditing({ ...editing, hint: e.target.value })}
                      placeholder="Petunjuk (opsional)"
                    />
                  </div>
                  {NEEDS_OPTIONS.has(editing.type) && (
                    <input
                      className={inputClass}
                      value={editing.options}
                      onChange={(e) => setEditing({ ...editing, options: e.target.value })}
                      placeholder="Opsi, pisahkan koma (min. 2)"
                    />
                  )}
                  <ShowIfPicker
                    bank={activeBank}
                    draft={editing.show}
                    excludeKey={editing.showKey}
                    onChange={(show) => setEditing({ ...editing, show })}
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px] font-bold">
                      <X className="w-3 h-3 inline" /> Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={editBusy || !editing.label.trim()}
                      className="px-2 py-1 rounded-lg bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40"
                    >
                      {editBusy ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[#FAF9F5] text-xs">
                  <label className={`flex items-start gap-2 flex-1 min-w-0 ${q.status === 'ARCHIVED' ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(q.id)}
                      onChange={() => toggle(q.id)}
                      disabled={q.status === 'ARCHIVED'}
                      title={q.status === 'ARCHIVED' ? 'Soal arsip — aktifkan dulu untuk dipakai' : undefined}
                    />
                    <span className="min-w-0">
                      <span className="font-bold text-[#1B1B1B]">{q.label}</span>
                      <span className="block text-[10px] text-[#8C8880]">{q.ownerSubdivision} · {q.type}{q.status && q.status !== 'ACTIVE' ? ` · ${q.status}` : ''}</span>
                      {q.showIf && q.showIf.key && (
                        <span className="mt-0.5 inline-block rounded-full bg-violet-100 text-violet-800 text-[9px] font-bold px-2 py-0.5">
                          lanjutan dari {bank.find((b) => b.key === q.showIf!.key)?.label || q.showIf.key}
                          {' '}{condText(q.showIf)}
                        </span>
                      )}
                      {(childrenByKey.get(q.key) || []).map((c) => (
                        <span key={c.id} className="mt-0.5 ml-1 inline-block rounded-full bg-sky-100 text-sky-800 text-[9px] font-bold px-2 py-0.5">
                          lanjutan: {c.label} {c.showIf ? condText(c.showIf) : ''}
                        </span>
                      ))}
                    </span>
                  </label>
                  {isKomisi && (
                    <span className="flex gap-0.5 shrink-0">
                      {['DROPDOWN', 'SELECT', 'SINGLE', 'MULTI', 'BOOLEAN'].includes(normEventQuestionType(q.type)) && (
                        <button type="button" title="Buat soal lanjutan (syarat otomatis ke soal ini)" onClick={() => startFollowUp(q)} className="p-1 text-[#8C8880] hover:text-sky-700">
                          <GitBranch className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button type="button" title="Ubah soal" onClick={() => startEdit(q)} className="p-1 text-[#8C8880] hover:text-[#181818]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {q.status === 'ARCHIVED' ? (
                        <>
                          <button type="button" title="Aktifkan lagi" onClick={() => void reactivateBank(q)} className="px-1.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                            Aktifkan
                          </button>
                          <button type="button" title="Hapus permanen termasuk penugasan & jawaban" onClick={() => void forceDeleteBank(q)} className="p-1 text-[#8C8880] hover:text-[#FF416C]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button type="button" title="Hapus soal" onClick={() => void deleteBank(q)} className="p-1 text-[#8C8880] hover:text-[#FF416C]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
          {bank.length === 0 && <li className="text-xs text-[#8C8880]">Katalog kosong — jalankan migrasi DB.</li>}
        </ul>
        </>
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
        <input id="eq-request-label" className={inputClass} placeholder="Label soal" value={reqForm.label} onChange={(e) => setReqForm((f) => ({ ...f, label: e.target.value }))} required />
        <div className="grid sm:grid-cols-2 gap-2">
          <select className={inputClass} value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
            {EVENT_QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
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
        {NEEDS_OPTIONS.has(reqForm.type) && (
          <input className={inputClass} placeholder="Opsi, pisahkan koma" value={reqForm.options} onChange={(e) => setReqForm((f) => ({ ...f, options: e.target.value }))} />
        )}
        <ShowIfPicker bank={activeBank} draft={reqShow} onChange={setReqShow} />
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
                {r.showIf && r.showIf.key && (
                  <p className="text-[10px] font-bold text-violet-700">
                    Hanya jika {bank.find((b) => b.key === r.showIf!.key)?.label || r.showIf.key}
                    {' = '}
                    {Array.isArray(r.showIf.in) ? (r.showIf.in as unknown[]).map(String).join(' / ') : String((r.showIf as { equals?: unknown }).equals ?? '')}
                  </p>
                )}
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
