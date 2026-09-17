import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, ArrowRight, UserPlus, Users, GraduationCap, Crown, CalendarPlus, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type Person = { id: string; name: string; avatar?: string | null };
type House = {
  groupId: string;
  name: string;
  batch: { mentorName?: string | null; comentorName?: string | null; mentorUserId?: string | null; comentorUserId?: string | null; period?: string } | null;
  foundedPeriod?: string;
};

type PendingConfirm = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: 'default' | 'danger' | 'gold';
  requireText?: string;
  run: () => Promise<void>;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Aktif', cls: 'bg-emerald-100 text-emerald-700' },
  ALUMNI: { label: 'Alumni', cls: 'bg-slate-200 text-slate-700' },
  PAST: { label: 'Generasi lalu', cls: 'bg-gray-100 text-gray-500' },
  MOVED: { label: 'Pindah', cls: 'bg-sky-100 text-sky-700' },
};

function DirectoryPicker({ label, value, onPick, disabled }: {
  label: string;
  value: Person | null;
  onPick: (p: Person | null) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState(value?.name || '');
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => { setQ(value?.name || ''); }, [value?.name]);
  useEffect(() => {
    if (disabled || q.trim().length < 2 || q.trim() === (value?.name || '').trim()) { setPeople([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/beyonders/leaders/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (r.ok) setPeople((await r.json()).people || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, disabled, value?.name]);
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex gap-1">
        <input value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs disabled:opacity-60" />
        {!disabled && value && (
          <button type="button" onClick={() => { onPick(null); setQ(''); }} className="text-[10px] font-bold text-[#8C8880] px-1">Hapus</button>
        )}
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {people.map((p) => (
            <button key={p.id} type="button" onClick={() => { onPick(p); setQ(p.name); setPeople([]); }}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F3F1EC] hover:bg-[#181818] hover:text-white">
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const RegenerationWizard: React.FC<{ houses: House[]; canEdit: boolean; onChanged: () => void }> = ({ houses, canEdit, onChanged }) => {
  const { addToast } = useApp();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [override, setOverride] = useState(false);
  const [undoable, setUndoable] = useState<{ action: string; summary: string; createdAt: string } | null>(null);

  const loadUndo = useCallback(async () => {
    try {
      const r = await fetch('/api/regen/undo/status', { credentials: 'include' });
      if (r.ok) setUndoable((await r.json()).undoable || null);
    } catch { /* skip */ }
  }, []);
  useEffect(() => { if (canEdit) void loadUndo(); }, [canEdit, loadUndo, houses]);

  const undoLastAction = async () => {
    setBusy('undo');
    try {
      const r = await fetch('/api/regen/undo', { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal membatalkan');
      addToast({ type: 'success', title: 'Aksi dibatalkan', description: d.summary });
      onChanged();
      void loadUndo();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  const currentBatchPeriod = houses[0]?.batch?.period || houses[0]?.foundedPeriod || null;
  const batchReady = Boolean(period) && currentBatchPeriod === period;

  useEffect(() => {
    if (period) return;
    const base = currentBatchPeriod || '2026-06';
    const [y, m] = String(base).split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    setPeriod(`${ny}-${String(nm).padStart(2, '0')}`);
  }, [currentBatchPeriod, period]);

  // ── Step 1: Alumni
  const [peopleQ, setPeopleQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [alumniSel, setAlumniSel] = useState<Person[]>([]);
  const searchPeople = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setPeople([]); return; }
    const r = await fetch(`/api/beyonders/leaders/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    if (r.ok) setPeople((await r.json()).people || []);
  }, []);
  const markStatus = async (status: 'ALUMNI' | 'ACTIVE') => {
    setBusy('alumni');
    try {
      const r = await fetch('/api/jemaat/member-status/bulk', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: alumniSel.map((p) => p.id), memberStatus: status }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal');
      addToast({ type: 'success', title: status === 'ALUMNI' ? 'Ditandai Alumni' : 'Diaktifkan kembali', description: `${d.updated || 0} orang, roster ${d.rosterUpdated || 0}` });
      setAlumniSel([]);
      onChanged();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  // ── Step 2: Buka generasi
  const openGeneration = async () => {
    setBusy('regen');
    try {
      const r = await fetch('/api/beyonders/leaders/regenerate', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPeriod: period, override }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal membuka generasi');
      addToast({ type: 'success', title: `Generasi ${d.generation} (${d.nextPeriod}) dibuka`, description: 'Lanjut ke Langkah 3: tetapkan pemimpin.' });
      setOverride(false);
      setStep(3);
      onChanged();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  // ── Step 3: Pemimpin
  const [leaders, setLeaders] = useState<Record<string, { mentor: Person | null; comentor: Person | null }>>({});
  useEffect(() => {
    setLeaders((prev) => {
      const next = { ...prev };
      for (const h of houses) {
        if (next[h.groupId]) continue;
        next[h.groupId] = {
          mentor: h.batch?.mentorUserId ? { id: h.batch.mentorUserId, name: h.batch.mentorName || '' } : null,
          comentor: h.batch?.comentorUserId ? { id: h.batch.comentorUserId, name: h.batch.comentorName || '' } : null,
        };
      }
      return next;
    });
  }, [houses]);

  const assignLeader = async (groupId: string, role: 'MENTOR' | 'CO_MENTOR', person: Person, houseName: string, replaces?: string | null) => {
    setBusy(`${groupId}:${role}`);
    try {
      const r = await fetch(`/api/beyonders/leaders/${groupId}/assign-leader`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, userId: person.id, period }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menetapkan peran');
      addToast({
        type: 'success',
        title: d.unchanged ? 'Tidak berubah' : `${role === 'MENTOR' ? 'Mentor' : 'Co-Mentor'} ditetapkan`,
        description: d.unchanged ? `Sudah ${person.name}` : `${houseName}: ${replaces ? `${replaces} → ` : ''}${person.name}`,
      });
      onChanged();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  // ── Step 4: Bawa anggota
  const [carry, setCarry] = useState<{ carried: number; skippedMoved: number; alumni: number; details?: Array<{ name: string }> } | null>(null);
  const [groupsData, setGroupsData] = useState<Array<{ id: string; name: string; members: Array<{ id: string; name: string; batchPeriod?: string | null; status?: string; familyRole?: string }> }>>([]);
  useEffect(() => {
    fetch('/api/db/groups', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGroupsData(d?.groups || []))
      .catch(() => {});
  }, [houses]);
  const runCarry = async (dryRun: boolean) => {
    setBusy(dryRun ? 'carry-preview' : 'carry');
    try {
      const r = await fetch('/api/beyonders/leaders/carry-members', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, dryRun }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal');
      setCarry(d);
      if (!dryRun) { addToast({ type: 'success', title: 'Anggota dibawa', description: `${d.carried} orang` }); onChanged(); }
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  // ── Step 5: Assign baru
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assignRole, setAssignRole] = useState<'MENTEE' | 'MENTOR' | 'CO_MENTOR'>('MENTEE');
  const [assignSel, setAssignSel] = useState<Person[]>([]);
  const runAssign = async () => {
    setBusy('assign');
    try {
      const r = await fetch('/api/beyonders/leaders/assign-members', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: assignGroupId, userIds: assignSel.map((p) => p.id), familyRole: assignRole, period }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal assign');
      addToast({ type: 'success', title: 'Ditugaskan', description: `${d.assigned} orang` });
      setAssignSel([]);
      onChanged();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally { setBusy(null); setPending(null); }
  };

  if (!canEdit) return null;

  const steps = [
    { id: 1 as const, label: '1 · Alumni', icon: GraduationCap, guard: true },
    { id: 2 as const, label: '2 · Buka generasi', icon: CalendarPlus, guard: true },
    { id: 3 as const, label: '3 · Pemimpin', icon: Crown, guard: batchReady },
    { id: 4 as const, label: '4 · Bawa anggota', icon: Users, guard: batchReady },
    { id: 5 as const, label: '5 · Assign baru', icon: UserPlus, guard: batchReady },
  ];

  return (
    <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s) => (
          <button key={s.id} type="button" disabled={!s.guard}
            onClick={() => { if (s.guard) setStep(s.id); }}
            title={!s.guard ? `Buka generasi ${period} dulu (Langkah 2)` : ''}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${
              step === s.id ? 'bg-[#181818] text-white' : s.guard ? 'bg-[#FAF9F5] border border-[#D9D7D0] text-[#5C5850]' : 'bg-[#FAF9F5] border border-dashed border-[#D9D7D0] text-[#C9C5BC] cursor-not-allowed'
            }`}>
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
        <label className="ml-auto text-[11px] font-semibold flex items-center gap-2">
          Periode generasi
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs" />
        </label>
      </div>

      {!batchReady && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Batch periode <b>{period}</b> belum ada (generasi berjalan: <b>{currentBatchPeriod || '—'}</b>). Jalankan <b>Langkah 2 · Buka generasi</b> dulu sebelum menetapkan pemimpin / membawa anggota / assign.</span>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#8C8880]">Tandai alumni generasi berjalan (tercatat + badge warna, akses grup dicabut). Alumni otomatis dilewati saat “Bawa anggota”.</p>
          <input value={peopleQ} onChange={(e) => { setPeopleQ(e.target.value); void searchPeople(e.target.value); }}
            placeholder="Cari nama…" className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const sel = alumniSel.some((x) => x.id === p.id);
              return (
                <button key={p.id} type="button" onClick={() => setAlumniSel((prev) => sel ? prev.filter((x) => x.id !== p.id) : [...prev, p])}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${sel ? 'bg-[#FF416C] text-white border-[#FF416C]' : 'bg-white border-[#D9D7D0] text-[#5C5850]'}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
          {alumniSel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-[#8C8880]">{alumniSel.length} dipilih</span>
              <button type="button" disabled={busy === 'alumni'}
                onClick={() => setPending({
                  title: `Tandai ${alumniSel.length} orang sebagai ALUMNI?`,
                  description: 'Roster generasi berjalan jadi ALUMNI + akses grup dicabut + status keanggotaan ALUMNI.',
                  requireText: 'ALUMNI', tone: 'danger', confirmLabel: 'Tandai Alumni',
                  run: () => markStatus('ALUMNI'),
                })}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-bold disabled:opacity-40">Tandai Alumni</button>
              <button type="button" disabled={busy === 'alumni'}
                onClick={() => setPending({
                  title: `Aktifkan kembali ${alumniSel.length} orang?`,
                  description: 'Status keanggotaan kembali ACTIVE (roster grup tidak otomatis dipulihkan).',
                  confirmLabel: 'Aktifkan kembali',
                  run: () => markStatus('ACTIVE'),
                })}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold disabled:opacity-40">Aktifkan kembali</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#8C8880]">Buat batch generasi baru untuk 10 rumah (generasi berjalan jadi non-current). Nama rumah di landing tetap.</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[11px] font-semibold flex items-center gap-2">
              Periode baru
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs" />
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override (tidak semua rumah “Siap regenerasi”)
            </label>
            <button type="button" disabled={busy === 'regen' || !period || currentBatchPeriod === period}
              onClick={() => setPending({
                title: `Buka generasi ${period} untuk 10 rumah?`,
                description: `Batch ${period} dibuat; generasi ${currentBatchPeriod} jadi non-current. Nama pemimpin disalin sementara (ganti di Langkah 3).`,
                requireText: 'REGENERASI', tone: 'gold', confirmLabel: 'Buka generasi',
                run: openGeneration,
              })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A227] text-[#181818] text-[11px] font-bold disabled:opacity-40">
              {busy === 'regen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Buka generasi berikutnya
            </button>
          </div>
          {currentBatchPeriod === period && (
            <p className="text-[11px] text-emerald-700">Batch {period} sudah ada (generasi berjalan). Lanjut ke Langkah 3.</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#8C8880]">Tetapkan Mentor/Co-Mentor generasi <b>{period}</b>. Pilih dari direktori agar peran portal sinkron (tanpa peran ganda). Pemimpin lama otomatis turun jadi <b>Mentee</b> di grup ini.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {houses.map((h) => {
              const d = leaders[h.groupId] || { mentor: null, comentor: null };
              return (
                <div key={h.groupId} className="rounded-2xl border border-[#D9D7D0]/60 p-3 space-y-2">
                  <p className="text-xs font-bold">{h.name}</p>
                  <DirectoryPicker label="Mentor baru" value={d.mentor} disabled={!batchReady}
                    onPick={(p) => setLeaders((prev) => ({ ...prev, [h.groupId]: { ...d, mentor: p } }))} />
                  <button type="button" disabled={busy === `${h.groupId}:MENTOR` || !d.mentor?.id || !batchReady}
                    onClick={() => d.mentor && setPending({
                      title: `Tetapkan Mentor ${h.name}?`,
                      description: <>{h.batch?.mentorName && h.batch.mentorName !== 'TBD' ? <><b>{h.batch.mentorName}</b> akan turun jadi <b>Mentee</b>. </> : null}Pemimpin baru: <b>{d.mentor.name}</b>. Peran portal ikut berpindah.</>,
                      confirmLabel: 'Tetapkan Mentor',
                      run: () => assignLeader(h.groupId, 'MENTOR', d.mentor as Person, h.name, h.batch?.mentorName || null),
                    })}
                    className="w-full py-1.5 rounded-xl bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40">
                    {busy === `${h.groupId}:MENTOR` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Tetapkan Mentor'}
                  </button>
                  <DirectoryPicker label="Co-Mentor baru" value={d.comentor} disabled={!batchReady}
                    onPick={(p) => setLeaders((prev) => ({ ...prev, [h.groupId]: { ...d, comentor: p } }))} />
                  <button type="button" disabled={busy === `${h.groupId}:CO_MENTOR` || !d.comentor?.id || !batchReady}
                    onClick={() => d.comentor && setPending({
                      title: `Tetapkan Co-Mentor ${h.name}?`,
                      description: <>{h.batch?.comentorName ? <><b>{h.batch.comentorName}</b> akan turun jadi <b>Mentee</b>. </> : null}Co-Mentor baru: <b>{d.comentor.name}</b>. Peran portal ikut berpindah.</>,
                      confirmLabel: 'Tetapkan Co-Mentor',
                      run: () => assignLeader(h.groupId, 'CO_MENTOR', d.comentor as Person, h.name, h.batch?.comentorName || null),
                    })}
                    className="w-full py-1.5 rounded-xl bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40">
                    {busy === `${h.groupId}:CO_MENTOR` ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Tetapkan Co-Mentor'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#8C8880]">Bawa anggota <b>ACTIVE</b> dari generasi sebelumnya ke <b>{period}</b>. Alumni & yang pindah grup dilewati. Pratinjau dulu (tidak menulis).</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy === 'carry-preview' || !batchReady} onClick={() => void runCarry(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850] disabled:opacity-40">
              {busy === 'carry-preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />} Pratinjau
            </button>
            <button type="button" disabled={busy === 'carry' || !batchReady}
              onClick={() => setPending({
                title: `Bawa anggota aktif ke ${period}?`,
                description: carry ? <>Akan dibawa <b>{carry.carried}</b> orang · dilewati (pindah) <b>{carry.skippedMoved}</b> · alumni <b>{carry.alumni}</b>.</> : 'Disarankan klik Pratinjau dulu.',
                requireText: 'BAWA', tone: 'gold', confirmLabel: 'Bawa anggota',
                run: () => runCarry(false),
              })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A227] text-[#181818] text-[11px] font-bold disabled:opacity-40">
              {busy === 'carry' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Bawa anggota aktif
            </button>
          </div>
          {carry && (
            <div className="rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] p-3 text-[11px] text-[#5C5850] space-y-1">
              <p>Dibawa: <b>{carry.carried}</b> · Dilewati (pindah grup): <b>{carry.skippedMoved}</b> · Alumni: <b>{carry.alumni}</b></p>
              {carry.details?.length ? <p className="text-[10px] text-[#8C8880]">{carry.details.slice(0, 20).map((d) => d.name).join(', ')}{carry.details.length > 20 ? ' …' : ''}</p> : null}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Status anggota per rumah</p>
            {houses.map((h) => {
              const g = groupsData.find((x) => x.id === h.groupId);
              const rows = (g?.members || []).filter((m) => m.status !== 'PAST');
              return (
                <div key={h.groupId} className="text-[11px]">
                  <span className="font-bold">{h.name}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rows.length === 0 && <span className="text-[#8C8880]">—</span>}
                    {rows.slice(0, 24).map((m) => {
                      const b = STATUS_BADGE[m.status || 'ACTIVE'] || STATUS_BADGE.ACTIVE;
                      return (
                        <span key={m.id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${b.cls}`} title={m.familyRole || ''}>
                          {m.name.split(' ')[0]} · {b.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <p className="text-[11px] text-[#8C8880]">Assign orang (baru) ke rumah untuk generasi <b>{period}</b>.</p>
          <div className="flex flex-wrap gap-2">
            <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              <option value="">Pilih rumah…</option>
              {houses.map((h) => <option key={h.groupId} value={h.groupId}>{h.name}</option>)}
            </select>
            <select value={assignRole} onChange={(e) => setAssignRole(e.target.value as 'MENTEE' | 'MENTOR' | 'CO_MENTOR')}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              <option value="MENTEE">Mentee</option>
              <option value="MENTOR">Mentor</option>
              <option value="CO_MENTOR">Co-Mentor</option>
            </select>
          </div>
          <input value={peopleQ} onChange={(e) => { setPeopleQ(e.target.value); void searchPeople(e.target.value); }}
            placeholder="Cari nama…" className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const sel = assignSel.some((x) => x.id === p.id);
              return (
                <button key={p.id} type="button"
                  onClick={() => setAssignSel((prev) => sel ? prev.filter((x) => x.id !== p.id) : [...prev, p])}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${sel ? 'bg-[#FF416C] text-white border-[#FF416C]' : 'bg-white border-[#D9D7D0] text-[#5C5850]'}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
          {assignSel.length > 0 && (
            <button type="button" disabled={busy === 'assign' || !assignGroupId || !batchReady}
              onClick={() => setPending({
                title: `Assign ${assignSel.length} orang ke ${houses.find((h) => h.groupId === assignGroupId)?.name || 'rumah'}?`,
                description: <>Role: <b>{assignRole}</b> · periode <b>{period}</b>. Peran lama grup lain orang ini akan dinonaktifkan (tanpa peran ganda).</>,
                confirmLabel: 'Assign',
                run: runAssign,
              })}
              className="px-3 py-1.5 rounded-xl bg-[#FF416C] text-white text-[11px] font-bold disabled:opacity-40">
              {busy === 'assign' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : `Assign ${assignSel.length} orang`}
            </button>
          )}
        </div>
      )}

      {undoable && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D9D7D0]">
          <span className="text-[10px] text-[#8C8880]">
            Aksi terakhir: <b className="text-[#1B1B1B]">{undoable.summary}</b>
          </span>
          <button type="button" disabled={busy === 'undo'}
            onClick={() => setPending({
              title: 'Batalkan aksi terakhir?',
              description: <>Mengembalikan data 10 rumah ke kondisi sebelum: <b>{undoable.summary}</b>. Pastikan tidak ada perubahan lain setelahnya.</>,
              requireText: 'UNDO', tone: 'danger', confirmLabel: 'Batalkan aksi',
              run: undoLastAction,
            })}
            className="ml-auto px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold disabled:opacity-40">
            {busy === 'undo' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Batalkan aksi terakhir'}
          </button>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.confirmLabel}
          tone={pending.tone}
          requireText={pending.requireText}
          busy={busy !== null}
          onConfirm={() => void pending.run()}
          onClose={() => { if (busy === null) setPending(null); }}
        />
      )}
    </div>
  );
};
