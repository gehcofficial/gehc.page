import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  HeartHandshake,
  History,
  Loader2,
  Moon,
  Printer,
  Undo2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DriveUploadButton } from './DriveUploadButton';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { SearchableOption } from '../../lib/searchable-options';
import {
  copyText,
  formatDayShort,
  formatPrayerList,
  prayerKindLabel,
  printText,
} from '../../lib/mask';

const KINDS = [
  { id: 'SAKIT', label: 'Sakit' },
  { id: 'DUKA', label: 'Duka' },
  { id: 'YUDISIUM', label: 'Yudisium' },
  { id: 'WISUDA', label: 'Wisuda' },
  { id: 'KERJA', label: 'Kerja / pindah' },
  { id: 'LAINNYA', label: 'Lainnya' },
  { id: 'UMUM', label: 'Umum (tanpa nama)' },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type EventRef = { id: string; name: string; slug?: string | null; eventDate?: string | null };

type Note = {
  id: string;
  kind: string;
  note: string;
  status: string;
  occurredOn?: string | null;
  createdAt?: string | null;
  prayedAt?: string | null;
  prayedCount?: number;
  lastPrayedOn?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
  isGeneral?: boolean;
  lateRecordedDays?: number;
  contextEventId?: string | null;
  contextEvent?: EventRef | null;
  subjectName?: string | null;
  subject?: { id: string | null; name: string; avatar?: string | null } | null;
  reporter?: { id: string; name: string } | null;
  prayedThisWeek?: boolean;
};

type View = 'laporan' | 'daftar' | 'minggu';

export const PastoralCareBoard: React.FC = () => {
  const { addToast, groups } = useApp();
  const [view, setView] = useState<View>('laporan');
  const [hideDetail, setHideDetail] = useState(false);

  // ---- Form laporan ----
  const [subjectUserId, setSubjectUserId] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [kind, setKind] = useState('SAKIT');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [contextEventId, setContextEventId] = useState('');
  const [contextEventLabel, setContextEventLabel] = useState('');
  const [visitPhoto, setVisitPhoto] = useState<{
    data: string;
    mimetype: string;
    filename: string;
  } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(false);

  // ---- Daftar ----
  const [notes, setNotes] = useState<Note[]>([]);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [confirmResolve, setConfirmResolve] = useState<Note | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  // ---- Doa Minggu ----
  const [prayerList, setPrayerList] = useState<{
    sunday: string;
    weekStart?: string;
    serviceEvent?: EventRef | null;
    notes: Note[];
    stats: { total: number; prayed: number; notPrayed: number };
  } | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [prayedOn, setPrayedOn] = useState(todayIso());

  const searchPeople = useCallback(async (query: string): Promise<SearchableOption[]> => {
    const url = `/api/pastoral-care/people?q=${encodeURIComponent(query)}${filterGroupId ? `&groupId=${encodeURIComponent(filterGroupId)}` : ''}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    return (d.people || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }));
  }, [filterGroupId]);

  const searchEvents = useCallback(async (query: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/pastoral-care/events?q=${encodeURIComponent(query)}`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    return (d.events || []).map((e: EventRef) => ({
      value: e.id,
      label: `${e.name}${e.eventDate ? ` — ${formatDayShort(String(e.eventDate).slice(0, 10))}` : ''}`,
    }));
  }, []);

  const load = useCallback(async () => {
    setLoadingNotes(true);
    const params = new URLSearchParams({ status: statusFilter, expired: 'include' });
    if (filterGroupId) params.set('groupId', filterGroupId);
    try {
      const r = await fetch(`/api/pastoral-care?${params.toString()}`, { credentials: 'include' });
      const d = await r.json();
      setNotes(d.notes || []);
    } catch {
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, [statusFilter, filterGroupId]);

  useEffect(() => { void load(); }, [load]);

  const loadWeek = useCallback(async () => {
    setLoadingWeek(true);
    try {
      const r = await fetch('/api/pastoral-care/prayer-list', { credentials: 'include' });
      const d = await r.json();
      setPrayerList({
        sunday: d.sunday || '',
        weekStart: d.weekStart,
        serviceEvent: d.serviceEvent || null,
        notes: d.notes || [],
        stats: d.stats || { total: 0, prayed: 0, notPrayed: 0 },
      });
    } catch {
      setPrayerList(null);
    } finally {
      setLoadingWeek(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'minggu') void loadWeek();
  }, [view, loadWeek]);

  const resetForm = () => {
    setNote('');
    setSubjectUserId('');
    setSubjectLabel('');
    setSubjectName('');
    setManualMode(false);
    setVisitPhoto(null);
    setContextEventId('');
    setContextEventLabel('');
    setOccurredOn(todayIso());
  };

  const isGeneral = kind === 'UMUM';
  const canSubmit = note.trim().length > 0
    && occurredOn.length === 10
    && (subjectUserId || subjectName.trim() || isGeneral);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/pastoral-care', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isGeneral
            ? {}
            : subjectUserId
              ? { subjectUserId }
              : { subjectName: subjectName.trim() }),
          kind,
          note: note.trim(),
          occurredOn,
          ...(contextEventId ? { contextEventId } : {}),
          ...(kind === 'SAKIT' || kind === 'DUKA' ? visitPhoto || {} : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        addToast({ type: 'error', title: d.error || 'Gagal menyimpan' });
        return;
      }
      resetForm();
      setConfirmSend(false);
      addToast({ type: 'success', title: 'Tercatat di Portal Doa (privat)' });
      setView('daftar');
      void load();
    } finally {
      setBusy(false);
    }
  };

  const resolveNote = async (n: Note) => {
    setConfirmResolve(null);
    const r = await fetch(`/api/pastoral-care/${n.id}/resolve`, { method: 'PATCH', credentials: 'include' });
    if (!r.ok) {
      addToast({ type: 'error', title: 'Gagal menutup catatan' });
      return;
    }
    addToast({ type: 'success', title: 'Catatan ditutup' });
    void load();
    if (view === 'minggu') void loadWeek();
  };

  const markPrayed = async (n: Note, on = todayIso()) => {
    const r = await fetch(`/api/pastoral-care/${n.id}/pray`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prayedOn: on }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal menandai doa' });
      return;
    }
    const patch = (list: Note[]) => list.map((x) => (x.id === n.id
      ? { ...x, prayedCount: d.note?.prayedCount ?? (x.prayedCount || 0) + 1, lastPrayedOn: d.note?.lastPrayedOn ?? on, prayedThisWeek: true }
      : x));
    setNotes(patch);
    setPrayerList((p) => (p ? {
      ...p,
      notes: patch(p.notes),
      stats: { ...p.stats, prayed: patch(p.notes).filter((x) => x.prayedThisWeek).length, notPrayed: patch(p.notes).filter((x) => !x.prayedThisWeek).length },
    } : p));
    addToast({ type: 'success', title: d.alreadyMarked ? 'Sudah ditandai pada tanggal itu' : 'Ditandai sudah didoakan' });
  };

  const undoPray = async (n: Note, on: string) => {
    const r = await fetch(`/api/pastoral-care/${n.id}/pray?on=${on}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) {
      addToast({ type: 'error', title: 'Gagal membatalkan tanda doa' });
      return;
    }
    addToast({ type: 'info', title: 'Tanda doa dibatalkan' });
    void load();
    if (view === 'minggu') void loadWeek();
  };

  const markAllWeek = async () => {
    const ids = (prayerList?.notes || []).filter((n) => !n.prayedThisWeek).map((n) => n.id);
    setConfirmBulk(false);
    if (!ids.length) {
      addToast({ type: 'info', title: 'Semua konteks minggu ini sudah ditandai' });
      return;
    }
    const r = await fetch('/api/pastoral-care/pray-bulk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteIds: ids, prayedOn }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal menandai' });
      return;
    }
    addToast({ type: 'success', title: `${d.marked || 0} konteks ditandai sudah didoakan` });
    void loadWeek();
    void load();
  };

  const weekText = useMemo(() => formatPrayerList((prayerList?.notes || []) as never, {
    title: `DOA MINGGU — ${formatDayShort(prayerList?.sunday)}`,
    hideDetail,
  }), [prayerList, hideDetail]);

  const onCopyWeek = async () => {
    const ok = await copyText(weekText);
    addToast({ type: ok ? 'success' : 'error', title: ok ? 'Teks doa disalin' : 'Clipboard diblokir' });
  };

  const badge = (n: Note) => (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        {prayerKindLabel(n.kind)}
      </span>
      {n.isGeneral && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Umum</span>
      )}
      {n.isExpired && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Kedaluwarsa</span>
      )}
      {Boolean(n.lateRecordedDays) && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
          Baru dicatat H+{n.lateRecordedDays}
        </span>
      )}
      {n.status === 'RESOLVED' && (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Selesai</span>
      )}
    </span>
  );

  const meta = (n: Note) => (
    <p className="text-[10px] text-[#8C8880] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {n.occurredOn && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Kejadian {formatDayShort(n.occurredOn)}</span>}
      {n.contextEvent && <span className="truncate">· {n.contextEvent.name}</span>}
      {n.reporter?.name && !hideDetail && <span>· Dilaporkan {n.reporter.name}</span>}
      <span className="inline-flex items-center gap-1">
        <History className="w-3 h-3" />
        {n.prayedCount ? `Terakhir didoakan ${formatDayShort(n.lastPrayedOn)} (${n.prayedCount}×)` : 'Belum pernah didoakan'}
      </span>
    </p>
  );

  return (
    <div className="space-y-4">
      {/* Tab */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { id: 'laporan' as View, label: 'Laporan baru', icon: <HeartHandshake className="w-3.5 h-3.5" /> },
          { id: 'daftar' as View, label: 'Daftar konteks', icon: <ClipboardList className="w-3.5 h-3.5" /> },
          { id: 'minggu' as View, label: 'Doa Minggu', icon: <Moon className="w-3.5 h-3.5" /> },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${view === t.id ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5C5850]">
          <input type="checkbox" checked={hideDetail} onChange={(e) => setHideDetail(e.target.checked)} />
          Sembunyikan detail
        </label>
      </div>

      {view === 'laporan' && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-[#EA580C]" />
            Laporkan kabar penggembalaan (bukan ubah profil orang lain)
          </p>
          {!isGeneral && (
            <>
              {!manualMode ? (
                <SearchableSelect
                  value={subjectUserId}
                  selectedLabel={subjectLabel}
                  onSearch={searchPeople}
                  onChange={(value, option) => {
                    setSubjectUserId(value);
                    setSubjectLabel(option?.label || '');
                    if (value) setSubjectName('');
                  }}
                  placeholder="Cari nama jemaat…"
                  emptyHint="Tidak ketemu? Pakai nama manual di bawah."
                  minQuery={2}
                />
              ) : null}
              {!subjectUserId && (
                <div className="space-y-1.5">
                  <input
                    value={subjectName}
                    onChange={(e) => {
                      setSubjectName(e.target.value);
                      setManualMode(e.target.value.trim().length > 0);
                    }}
                    placeholder="Atau pakai nama ini (belum terdaftar)…"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
                  />
                  {manualMode && (
                    <button
                      type="button"
                      onClick={() => { setSubjectName(''); setManualMode(false); }}
                      className="text-[11px] font-bold text-[#8C8880] underline"
                    >
                      Kembali cari jemaat terdaftar
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {isGeneral && (
            <p className="text-[11px] text-[#5C5850] bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
              Konteks umum: dipakai untuk syukur / doa jemaat / bangsa tanpa menyebut nama orang.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] shrink-0">Tanggal kejadian</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="bg-transparent text-xs w-full"
              />
            </label>
          </div>
          <SearchableSelect
            value={contextEventId}
            selectedLabel={contextEventLabel}
            onSearch={searchEvents}
            onChange={(value, option) => {
              setContextEventId(value);
              setContextEventLabel(option?.label || '');
            }}
            placeholder="Tautkan ke kegiatan (opsional)…"
            emptyHint="Nama kegiatan tidak ketemu — biarkan kosong saja."
            minQuery={2}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Catatan singkat untuk doa — tanpa diagnosis."
            className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
          />
          {(kind === 'SAKIT' || kind === 'DUKA') && (
            <div className="pt-1">
              <p className="text-[10px] text-[#8C8880] mb-1">Foto kunjungan Diakonia (privat, bukan landing)</p>
              <DriveUploadButton
                label={visitPhoto ? 'Foto kunjungan siap' : 'Lampirkan foto kunjungan'}
                hasFile={Boolean(visitPhoto)}
                onFile={async (payload) => setVisitPhoto(payload)}
                onClear={() => setVisitPhoto(null)}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfirmSend(true)}
            disabled={!canSubmit}
            className="px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40"
          >
            Kirim ke Portal Doa
          </button>
        </div>
      )}

      {view === 'daftar' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {(['OPEN', 'RESOLVED', 'ALL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusFilter === s ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
                >
                  {s === 'OPEN' ? 'Aktif' : s === 'RESOLVED' ? 'Selesai' : 'Semua'}
                </button>
              ))}
            </div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8C8880] ml-auto">Filter grup</label>
            <select
              value={filterGroupId}
              onChange={(e) => { setFilterGroupId(e.target.value); setSubjectUserId(''); setSubjectLabel(''); setSubjectName(''); }}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
            >
              <option value="">Semua kelompok</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {loadingNotes ? (
            <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat catatan…</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Tidak ada catatan yang boleh kamu lihat.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-2xl border border-[#D9D7D0]/50 bg-white p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold">{n.isGeneral ? 'Doa umum' : (n.subject?.name || n.subjectName || '—')}</span>
                  {badge(n)}
                </div>
                <p className="mt-1 text-[#5C5850]">{n.note}</p>
                {meta(n)}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {n.status !== 'RESOLVED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => markPrayed(n)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Sudah didoakan
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResolve(n)}
                        className="text-[11px] font-bold text-[#8C8880]"
                      >
                        Tandai selesai
                      </button>
                    </>
                  )}
                  {n.lastPrayedOn && (n.lastPrayedOn === todayIso() || n.prayedThisWeek) && (
                    <button
                      type="button"
                      onClick={() => undoPray(n, n.lastPrayedOn as string)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700"
                    >
                      <Undo2 className="w-3 h-3" /> Batalkan tanda doa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHistoryFor(historyFor === n.id ? null : n.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C8880]"
                  >
                    <History className="w-3 h-3" /> Riwayat
                  </button>
                </div>
                {historyFor === n.id && (
                  <div className="mt-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-2">
                    <PrayerHistory noteId={n.id} hideDetail={hideDetail} />
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {view === 'minggu' && (
        <>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black text-indigo-800 inline-flex items-center gap-1.5">
                <Moon className="w-4 h-4" />
                Ibadah Minggu, {formatDayShort(prayerList?.sunday) || '—'}
              </p>
              {prayerList?.serviceEvent?.name && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700">
                  {prayerList.serviceEvent.name}
                </span>
              )}
              <span className="ml-auto text-[11px] font-bold text-indigo-700">
                {prayerList ? `${prayerList.stats.prayed}/${prayerList.stats.total} sudah didoakan` : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#5C5850]">
                Tanggal doa
                <input
                  type="date"
                  value={prayedOn}
                  onChange={(e) => setPrayedOn(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => setConfirmBulk(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tandai semua sudah didoakan
              </button>
              <button
                type="button"
                onClick={onCopyWeek}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[11px] font-bold"
              >
                <Copy className="w-3.5 h-3.5" /> Salin teks
              </button>
              <button
                type="button"
                onClick={() => printText(`Doa Minggu ${formatDayShort(prayerList?.sunday)}`, weekText)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[11px] font-bold"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak
              </button>
              <button
                type="button"
                onClick={() => setHideDetail((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[11px] font-bold"
              >
                {hideDetail ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {hideDetail ? 'Detail disembunyikan' : 'Sembunyikan detail'}
              </button>
            </div>
          </div>

          {loadingWeek ? (
            <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat daftar doa…</p>
          ) : !prayerList?.notes.length ? (
            <p className="text-xs text-[#8C8880]">Belum ada konteks doa aktif untuk minggu ini.</p>
          ) : (
            <div className="space-y-2">
              {prayerList.notes.map((n) => (
                <div key={n.id} className={`rounded-2xl border p-3 text-xs ${n.prayedThisWeek ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#D9D7D0]/50 bg-white'}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">
                      {n.isGeneral ? 'Doa umum' : (n.subject?.name || n.subjectName || '—')}
                    </span>
                    {badge(n)}
                  </div>
                  {!hideDetail && <p className="mt-1 text-[#5C5850]">{n.note}</p>}
                  {meta(n)}
                  <button
                    type="button"
                    onClick={() => markPrayed(n, prayedOn)}
                    className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${n.prayedThisWeek ? 'text-emerald-700' : 'text-[#8C8880]'}`}
                  >
                    {n.prayedThisWeek ? <><CheckCheck className="w-3 h-3" /> Sudah didoakan Minggu ini</> : <><CheckCircle2 className="w-3 h-3" /> Tandai sudah didoakan</>}
                  </button>
                  {n.prayedThisWeek && (
                    <button
                      type="button"
                      onClick={() => undoPray(n, prayedOn)}
                      className="mt-2 ml-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700"
                    >
                      <Undo2 className="w-3 h-3" /> Batalkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-dashed border-[#D9D7D0] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1">Pratinjau teks (untuk pendoa)</p>
            <pre className="text-[11px] text-[#5C5850] whitespace-pre-wrap font-mono">{weekText}</pre>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmSend}
        title="Kirim ke Portal Doa?"
        tone="default"
        confirmLabel="Ya, kirim"
        busy={busy}
        onClose={() => setConfirmSend(false)}
        onConfirm={submit}
        description={(
          <div className="space-y-1">
            <p>
              <b>{isGeneral ? 'Doa umum' : (subjectLabel || subjectName || '—')}</b> · {prayerKindLabel(kind)}
            </p>
            <p>Kejadian: {formatDayShort(occurredOn)}{contextEventLabel ? ` · ${contextEventLabel}` : ''}</p>
            <p className="italic">“{note.trim().slice(0, 120)}{note.trim().length > 120 ? '…' : ''}”</p>
            <p className="text-[#8C8880]">Data ini privat — tidak tampil di landing publik.</p>
          </div>
        )}
      />

      <ConfirmDialog
        open={Boolean(confirmResolve)}
        title="Tandai catatan selesai?"
        confirmLabel="Ya, selesai"
        onClose={() => setConfirmResolve(null)}
        onConfirm={() => confirmResolve && resolveNote(confirmResolve)}
        description={<p>{confirmResolve?.isGeneral ? 'Doa umum' : (confirmResolve?.subject?.name || confirmResolve?.subjectName)} akan dipindah ke daftar selesai.</p>}
      />

      <ConfirmDialog
        open={confirmBulk}
        title="Tandai semua sudah didoakan?"
        confirmLabel="Ya, tandai semua"
        onClose={() => setConfirmBulk(false)}
        onConfirm={markAllWeek}
        description={(
          <p>
            Menandai <b>{prayerList?.stats.notPrayed || 0}</b> konteks Doa Minggu pada tanggal {formatDayShort(prayedOn)}.
          </p>
        )}
      />
    </div>
  );
};

/** Riwayat tanggal doa untuk satu catatan. */
const PrayerHistory: React.FC<{ noteId: string; hideDetail?: boolean }> = ({ noteId, hideDetail = false }) => {
  const [rows, setRows] = useState<Array<{ id: string; prayedOn: string; prayedBy?: { name?: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/pastoral-care/${noteId}/prayer-log`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => { if (alive) setRows(d.logs || []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [noteId]);
  if (loading) return <p className="text-[10px] text-[#8C8880]">Memuat riwayat…</p>;
  if (!rows.length) return <p className="text-[10px] text-[#8C8880]">Belum pernah ditandai didoakan.</p>;
  return (
    <ul className="space-y-0.5">
      {rows.map((r) => (
        <li key={r.id} className="text-[10px] text-[#5C5850] flex items-center gap-1">
          <Undo2 className="w-3 h-3 text-[#B8B4AC]" />
          {formatDayShort(r.prayedOn)}
          {!hideDetail && r.prayedBy?.name ? ` · ${r.prayedBy.name}` : ''}
        </li>
      ))}
    </ul>
  );
};
