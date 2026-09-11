import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ArrowLeftRight, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Tab gabungan "Ibadah Mingguan" — menggantikan Rencana bulan + Serving.
 * Alur: tentukan jenis layanan (Mentoring W1 / Serving W2+ bergilir) +
 * pola penanggung & tuan rumah → tema bulan → expand minggu (tema mingguan)
 * → kondisi khusus (GABUNGAN/LIBUR/ALIH, geser otomatis + rebase review).
 * Matriks divisi tidak ada di sini (dikelola di Program & Event / Panel Divisi).
 */

type AssignRow = {
  id: string;
  eventDate: string;
  serviceType?: string | null;
  responsibleGroupId?: string | null;
  hostGroupId?: string | null;
  cycleIndex?: number | null;
  isSwapped?: boolean;
  swapReason?: string | null;
  responsibleGroup?: { id: string; name: string } | null;
  hostGroup?: { id: string; name: string } | null;
  event?: { id: string; name: string; status: string } | null;
  isVirtual?: boolean;
  isSpecial?: boolean;
  condition?: string | null;
  note?: string | null;
  partnerLabel?: string | null;
  linkedEventId?: string | null;
  expectedCycleIndex?: number | null;
  needsSync?: boolean;
  override?: { condition: string; note?: string | null; partnerLabel?: string | null; linkedEventId?: string | null } | null;
};

type PlanWeek = {
  index: number;
  date?: string;
  theme?: string;
  mentoringTheme?: string;
  servingTheme?: string;
};

type Override = { eventDate: string; condition: string; note?: string | null; partnerLabel?: string | null; linkedEventId?: string | null };

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sundaysOfMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m - 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const COND_LABEL: Record<string, string> = { GABUNGAN: 'Gabungan', LIBUR: 'Libur', ALIH: 'Alih' };

export const ServicePlanPanel: React.FC = () => {
  const { addToast, currentRole, isKomisi, isBodTimkerja, isDidaskalia } = useApp();
  // Tema = hasil rembuk BOD Tim Kerja + Didaskalia (+ Komisi). Selain itu read-only.
  const canWrite = isKomisi || currentRole === 'SUPERADMIN' || isBodTimkerja || isDidaskalia;
  const canSwap = currentRole === 'KOMISI' || currentRole === 'SUPERADMIN';
  const canCondition = currentRole === 'KOMISI' || currentRole === 'SUPERADMIN';

  const [horizon, setHorizon] = useState<3 | 4>(4);
  const [anchorYm] = useState(currentYearMonth());
  const months = Array.from({ length: horizon }, (_, i) => addMonths(anchorYm, i));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [currentYearMonth()]: true });
  const [plans, setPlans] = useState<Record<string, { theme: string; weeks: PlanWeek[] }>>({});
  const [plansLoading, setPlansLoading] = useState<Record<string, boolean>>({});
  const [savingTheme, setSavingTheme] = useState<Record<string, boolean>>({});
  const [genBusy, setGenBusy] = useState<Record<string, boolean>>({});

  const [rows, setRows] = useState<AssignRow[]>([]);
  const [virtual, setVirtual] = useState<AssignRow[]>([]);
  const [specials, setSpecials] = useState<AssignRow[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  // Antrean usulan tukar mutualisme (approver: Komisi/BOD/kepala divisi/Didaskalia)
  type SwapReq = {
    id: string; aEventDate: string; bEventDate: string; scope: string;
    requesterGroupId: string; requesterGroupName?: string | null;
    peerMentor?: string | null; reason: string; status: string; decideNote?: string | null;
  };
  const [swapReqs, setSwapReqs] = useState<SwapReq[]>([]);
  const [isSwapApprover, setIsSwapApprover] = useState(false);
  const [decideBusy, setDecideBusy] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const fetchSwapReqs = useCallback(async () => {
    try {
      const r = await fetch('/api/service-swap-requests?status=ALL', { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        const list = (d.requests || []) as SwapReq[];
        setSwapReqs(list.sort((a, b) => (a.status === 'PENDING' ? -1 : 1)));
        setIsSwapApprover(Boolean(d.approver));
      }
    } catch { /* abaikan */ }
  }, []);
  const decideSwap = async (id: string, action: 'approve' | 'reject') => {
    const note = action === 'reject' ? (rejectNote[id] || '').trim() : '';
    if (action === 'reject' && !note) {
      addToast({ type: 'error', title: 'Catatan penolakan wajib diisi' });
      return;
    }
    setDecideBusy(id);
    try {
      const r = await fetch(`/api/service-swap-requests/${id}/${action}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ note }) : '{}',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memutus');
      addToast({ type: 'success', title: action === 'approve' ? 'Disetujui — jadwal ditukar' : 'Usulan ditolak' });
      await Promise.all([fetchSwapReqs(), fetchSchedule()]);
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setDecideBusy(null);
    }
  };

  // Swap per-peran: { date, scope } + target + reason
  const [swapForm, setSwapForm] = useState<{ date: string; scope: 'RESPONSIBLE' | 'HOST' } | null>(null);
  const [swapTarget, setSwapTarget] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapBusy, setSwapBusy] = useState(false);
  // Kondisi khusus per minggu
  const [condDate, setCondDate] = useState<string | null>(null);
  const [condValue, setCondValue] = useState('GABUNGAN');
  const [condNote, setCondNote] = useState('');
  const [condPartner, setCondPartner] = useState('');
  const [condLinked, setCondLinked] = useState('');
  const [condBusy, setCondBusy] = useState(false);
  const [rebaseBusy, setRebaseBusy] = useState(false);

  const fromISO = `${anchorYm}-01`;

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/serving-assignments?from=${fromISO}&horizon=${horizon}&includeVirtual=1`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat jadwal');
      setRows(d.assignments || []);
      setVirtual(d.virtual || []);
      setSpecials(d.specials || []);
      setOverrides(d.overrides || []);
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal memuat jadwal' });
    } finally {
      setLoading(false);
    }
  }, [addToast, fromISO, horizon]);

  useEffect(() => { fetchSchedule(); fetchSwapReqs(); }, [fetchSchedule, fetchSwapReqs]);

  const loadPlan = useCallback(async (ym: string) => {
    setPlansLoading((p) => ({ ...p, [ym]: true }));
    try {
      const r = await fetch(`/api/ministry-plans/${ym}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat rencana');
      const rawWeeks: PlanWeek[] = Array.isArray(d.plan?.weeks) ? d.plan.weeks : [];
      const sundays = sundaysOfMonth(ym);
      const weeks: PlanWeek[] = sundays.map((date, i) => {
        const found = rawWeeks.find((w) => String(w?.date || '').slice(0, 10) === date)
          || rawWeeks.find((w) => Number(w?.index) === i + 1);
        return { index: i + 1, date, theme: found?.theme || '', mentoringTheme: found?.mentoringTheme || '', servingTheme: found?.servingTheme || '' };
      });
      setPlans((p) => ({ ...p, [ym]: { theme: d.plan?.theme || '', weeks } }));
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal memuat rencana' });
    } finally {
      setPlansLoading((p) => ({ ...p, [ym]: false }));
    }
  }, [addToast]);

  useEffect(() => {
    months.forEach((ym) => {
      if (expanded[ym] && !plans[ym] && !plansLoading[ym]) void loadPlan(ym);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(months), JSON.stringify(expanded)]);

  useEffect(() => {
    if (!canCondition) return;
    fetch('/api/events', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEvents((d.events || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))))
      .catch(() => setEvents([]));
  }, [canCondition]);

  const byDate = new Map<string, AssignRow>();
  [...rows, ...virtual].forEach((r) => byDate.set(String(r.eventDate).slice(0, 10), r));
  const specialsByDate = new Map<string, AssignRow>();
  specials.forEach((r) => specialsByDate.set(String(r.eventDate).slice(0, 10), r));
  const overridesByDate = new Map<string, Override>();
  overrides.forEach((o) => overridesByDate.set(o.eventDate, o));

  const setWeekTheme = (ym: string, weekIndex: number, isMentoring: boolean, value: string) => {
    setPlans((p) => {
      const cur = p[ym];
      if (!cur) return p;
      return {
        ...p,
        [ym]: {
          ...cur,
          weeks: cur.weeks.map((w) => (w.index === weekIndex ? { ...w, [isMentoring ? 'mentoringTheme' : 'servingTheme']: value } : w)),
        },
      };
    });
  };

  const saveMonth = async (ym: string) => {
    const plan = plans[ym];
    if (!plan) return;
    setSavingTheme((s) => ({ ...s, [ym]: true }));
    try {
      const r = await fetch(`/api/ministry-plans/${ym}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: plan.theme, weeks: plan.weeks }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal simpan');
      addToast({ type: 'success', title: `Rencana ${ym} disimpan` });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal simpan' });
    } finally {
      setSavingTheme((s) => ({ ...s, [ym]: false }));
    }
  };

  const generateMonth = async (ym: string) => {
    const plan = plans[ym];
    if (!plan) return;
    setGenBusy((s) => ({ ...s, [ym]: true }));
    try {
      const r = await fetch(`/api/ministry-plans/${ym}/generate-services`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bipra: 'Pemuda', kolom: null, division: 'LITURGIA', serviceSet: 'BOTH', weeks: plan.weeks }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal generate.');
      addToast({
        type: 'success',
        title: `Event ibadah dibuat: ${d.created?.length || 0}`,
        description: d.skipped?.length ? `Dilewati: ${d.skipped.slice(0, 3).join(' | ')}${d.skipped.length > 3 ? ' …' : ''}` : undefined,
      });
      await fetchSchedule();
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal generate' });
    } finally {
      setGenBusy((s) => ({ ...s, [ym]: false }));
    }
  };

  const doSwap = async () => {
    if (!swapForm || !swapTarget || !swapReason.trim()) {
      addToast({ type: 'error', title: 'Lengkapi tanggal lawan dan alasan' });
      return;
    }
    setSwapBusy(true);
    try {
      const r = await fetch('/api/serving-assignments/swap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aEventDate: swapForm.date, bEventDate: swapTarget, reason: swapReason.trim(), scope: swapForm.scope }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal tukar');
      addToast({ type: 'success', title: `Berhasil tukar ${swapForm.scope === 'RESPONSIBLE' ? 'penanggung jawab' : 'tuan rumah'}` });
      setSwapForm(null); setSwapTarget(''); setSwapReason('');
      await fetchSchedule();
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal tukar' });
    } finally {
      setSwapBusy(false);
    }
  };

  const doRebase = async () => {
    setRebaseBusy(true);
    try {
      const r = await fetch('/api/serving-assignments/rebase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromISO }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal rebase');
      addToast({ type: 'success', title: d.updated ? `Sinkron: ${d.updated} baris digeser` : 'Sudah sinkron — tidak ada yang digeser' });
      await fetchSchedule();
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal rebase' });
    } finally {
      setRebaseBusy(false);
    }
  };

  const openCond = (date: string) => {
    const ov = overridesByDate.get(date);
    setCondDate(date);
    setCondValue(ov?.condition || 'GABUNGAN');
    setCondNote(ov?.note || '');
    setCondPartner(ov?.partnerLabel || '');
    setCondLinked(ov?.linkedEventId || '');
  };

  const saveCond = async () => {
    if (!condDate) return;
    setCondBusy(true);
    try {
      const r = await fetch(`/api/service-overrides/${condDate}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition: condValue, note: condNote.trim() || null, partnerLabel: condPartner.trim() || null, linkedEventId: condLinked || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal simpan kondisi');
      addToast({ type: 'success', title: `Minggu ${condDate} → ${condValue}` });
      setCondDate(null);
      await fetchSchedule();
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal simpan' });
    } finally {
      setCondBusy(false);
    }
  };

  const deleteCond = async (date: string) => {
    if (!window.confirm(`Kembalikan ${date} ke NORMAL (jadwal bergilir)?`)) return;
    const r = await fetch(`/api/service-overrides/${date}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      addToast({ type: 'error', title: d.error || 'Gagal hapus' });
      return;
    }
    addToast({ type: 'success', title: 'Kondisi dihapus — kembali normal' });
    if (condDate === date) setCondDate(null);
    await fetchSchedule();
  };

  const realCount = rows.length;
  const virtCount = virtual.length;
  const needsSyncCount = rows.filter((r) => r.needsSync).length;
  const realDates = rows.filter((r) => !r.isVirtual).map((r) => String(r.eventDate).slice(0, 10));

  if (loading) return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat jadwal…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-black text-[#1B1B1B]">Ibadah Mingguan — Mentoring & Serving Bergilir (Horizon {horizon} bulan)</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{realCount} real + {virtCount} prediksi</span>
        {needsSyncCount > 0 && canSwap && (
          <button type="button" onClick={() => void doRebase()} disabled={rebaseBusy} className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${rebaseBusy ? 'animate-spin' : ''}`} /> {needsSyncCount} perlu sinkron — terapkan pergeseran
          </button>
        )}
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => setHorizon(3)} className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${horizon === 3 ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>3 bulan</button>
          <button type="button" onClick={() => setHorizon(4)} className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${horizon === 4 ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>4 bulan</button>
        </div>
      </div>
      <p className="text-xs text-[#8C8880] leading-relaxed">W1 tiap bulan = Mentoring (Komisi+Tim Kerja). W2+ = Serving bergilir 10 pasang (offset +5). Minggu GABUNGAN/LIBUR/ALIH tidak consume siklus — prediksi bergeser otomatis, baris real yang terdampak ditandai untuk rebase.</p>

      {(isSwapApprover || swapReqs.some((q) => q.status === 'PENDING')) && swapReqs.length > 0 && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-800">
            Usulan tukar antar-grup (mutualisme) {swapReqs.filter((q) => q.status === 'PENDING').length > 0 && `— ${swapReqs.filter((q) => q.status === 'PENDING').length} menunggu`}
          </p>
          {swapReqs.slice(0, 10).map((q) => (
            <div key={q.id} className="p-2.5 rounded-xl bg-white border border-violet-100 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-black text-[#1B1B1B]">{q.aEventDate} ↔ {q.bEventDate}</span>
                <span className="text-[#8C8880]">{q.scope === 'RESPONSIBLE' ? 'penanggung' : 'tuan rumah'} · {q.requesterGroupName || q.requesterGroupId}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border ${q.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-200' : q.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{q.status}</span>
              </div>
              <p className="text-[11px] text-[#8C8880]">{q.reason}{q.peerMentor ? ` (sepakat dgn ${q.peerMentor})` : ''}</p>
              {q.status === 'REJECTED' && q.decideNote && <p className="text-[11px] text-[#8C8880] italic">Catatan: {q.decideNote}</p>}
              {q.status === 'PENDING' && isSwapApprover && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={rejectNote[q.id] || ''}
                    onChange={(e) => setRejectNote((m) => ({ ...m, [q.id]: e.target.value }))}
                    placeholder="Catatan penolakan (wajib bila tolak)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-xl border border-[#D9D7D0] text-xs"
                  />
                  <button type="button" onClick={() => void decideSwap(q.id, 'approve')} disabled={decideBusy === q.id} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
                    {decideBusy === q.id ? '…' : 'Setujui & tukar'}
                  </button>
                  <button type="button" onClick={() => void decideSwap(q.id, 'reject')} disabled={decideBusy === q.id} className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50">
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {months.map((ym) => {
        const open = !!expanded[ym];
        const plan = plans[ym];
        const sundays = sundaysOfMonth(ym);
        const monthLabel = new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return (
          <div key={ym} className="rounded-2xl border border-[#D9D7D0] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                const next = !open;
                setExpanded((e) => ({ ...e, [ym]: next }));
                if (next && !plans[ym] && !plansLoading[ym]) void loadPlan(ym);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 bg-[#FAF9F5] hover:bg-[#F0EFEB] text-left"
            >
              {open ? <ChevronDown className="w-4 h-4 text-[#8C8880]" /> : <ChevronRight className="w-4 h-4 text-[#8C8880]" />}
              <span className="text-sm font-black text-[#1B1B1B] capitalize">{monthLabel}</span>
              {plan?.theme && <span className="text-[11px] text-[#8C8880] truncate">· {plan.theme}</span>}
            </button>

            {open && (
              <div className="p-3 space-y-3">
                {canWrite ? (
                  <div className="flex gap-2">
                    <input
                      value={plan?.theme || ''}
                      onChange={(e) => setPlans((p) => ({ ...p, [ym]: { theme: e.target.value, weeks: p[ym]?.weeks || [] } }))}
                      placeholder="Tema bulan"
                      className="flex-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                    />
                    <button type="button" onClick={() => void saveMonth(ym)} disabled={savingTheme[ym] || !plan} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
                      {savingTheme[ym] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan tema'}
                    </button>
                    <button type="button" onClick={() => void generateMonth(ym)} disabled={genBusy[ym] || !plan} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5">
                      {genBusy[ym] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /> Buatkan event ibadah</>}
                    </button>
                  </div>
                ) : (
                  <p className="px-3 py-2 rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] text-sm text-[#1B1B1B]">{plan?.theme || 'Belum ada tema bulan'}</p>
                )}

                {plansLoading[ym] ? (
                  <p className="text-xs text-[#8C8880]">Memuat minggu…</p>
                ) : (
                  <div className="space-y-2">
                    {sundays.map((iso, i) => {
                      const weekIndex = i + 1;
                      const isMentoring = i === 0;
                      const w = plan?.weeks.find((x) => String(x?.date || '').slice(0, 10) === iso)
                        || plan?.weeks.find((x) => Number(x?.index) === weekIndex);
                      const themeVal = isMentoring ? (w?.mentoringTheme || w?.theme || '') : (w?.servingTheme || w?.theme || '');
                      const assign = byDate.get(iso);
                      const special = specialsByDate.get(iso);
                      const ov = overridesByDate.get(iso) || assign?.override || null;
                      const condOpen = condDate === iso;
                      return (
                        <div key={iso} className={`rounded-xl border p-3 space-y-2 ${special ? 'border-violet-200 bg-violet-50/50' : 'border-[#EFEDE8] bg-white'}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-[#1B1B1B]">W{weekIndex} · {fmtDate(iso)}</span>
                            {special ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-bold">
                                {COND_LABEL[special.condition || ov?.condition || ''] || special.condition}{special.partnerLabel ? ` — ${special.partnerLabel}` : ''}
                              </span>
                            ) : (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${isMentoring ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                {isMentoring ? 'M · Mentoring' : 'S · Serving'}
                              </span>
                            )}
                            {assign && !assign.isVirtual && <span className="text-[10px] text-[#8C8880]">real</span>}
                            {assign?.isVirtual && <span className="text-[10px] text-sky-700">prediksi</span>}
                            {assign?.isSwapped && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold" title={assign.swapReason || ''}>tukar</span>}
                            {assign?.needsSync && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold"><AlertTriangle className="w-3 h-3" /> perlu sinkron</span>}
                            {ov?.note && <span className="text-[10px] text-[#8C8880] italic" title={ov.note}>📝</span>}
                            <span className="ml-auto flex gap-1.5">
                              {canSwap && assign && !assign.isVirtual && !special && (
                                <>
                                  <button type="button" title="Tukar penanggung jawab saja" onClick={() => { setSwapForm({ date: iso, scope: 'RESPONSIBLE' }); setSwapTarget(''); setSwapReason(''); }} className="text-[10px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880] hover:text-[#1B1B1B]">⇄ Penanggung</button>
                                  <button type="button" title="Tukar tuan rumah saja" onClick={() => { setSwapForm({ date: iso, scope: 'HOST' }); setSwapTarget(''); setSwapReason(''); }} className="text-[10px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880] hover:text-[#1B1B1B]">⇄ Tuan rumah</button>
                                </>
                              )}
                              {canCondition && (
                                <button type="button" onClick={() => (condOpen ? setCondDate(null) : openCond(iso))} className="text-[10px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880] hover:text-[#1B1B1B]">Kondisi</button>
                              )}
                            </span>
                          </div>

                          {canWrite ? (
                            <input
                              value={themeVal}
                              onChange={(e) => setWeekTheme(ym, weekIndex, isMentoring, e.target.value)}
                              placeholder={isMentoring ? 'Tema mentoring minggu ini' : 'Tema serving minggu ini'}
                              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
                            />
                          ) : (
                            themeVal ? <p className="text-xs text-[#1B1B1B] font-semibold">{themeVal}</p> : null
                          )}

                          {!special && assign && (assign.responsibleGroup || assign.hostGroup) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 font-bold">{assign.responsibleGroup?.name || assign.responsibleGroupId}</span>
                              <span className="text-[#8C8880]">→</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">{assign.hostGroup?.name || assign.hostGroupId}</span>
                              {assign.cycleIndex != null && <span className="font-mono text-[#5C5850]">idx {assign.cycleIndex}/10</span>}
                              {assign.event?.name && <span className="text-[#8C8880] truncate max-w-[220px]" title={assign.event.name}>{assign.event.name}</span>}
                            </div>
                          )}
                          {special?.condition === 'ALIH' && special.linkedEventId && (
                            <p className="text-[11px] text-[#8C8880]">Dialihkan ke event <span className="font-mono">{special.linkedEventId}</span></p>
                          )}

                          {swapForm?.date === iso && (
                            <div className="grid sm:grid-cols-3 gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200">
                              <select value={swapTarget} onChange={(e) => setSwapTarget(e.target.value)} className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white">
                                <option value="">Tanggal lawan…</option>
                                {realDates.filter((d) => d !== iso).map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}
                              </select>
                              <input value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="Alasan tukar (wajib)" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs sm:col-span-2" />
                              <div className="sm:col-span-3 flex justify-end gap-2">
                                <button type="button" onClick={() => setSwapForm(null)} className="px-3 py-1.5 rounded-xl text-xs text-[#8C8880]">Batal</button>
                                <button type="button" onClick={() => void doSwap()} disabled={swapBusy || !swapTarget || !swapReason.trim()} className="px-4 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5">
                                  <ArrowLeftRight className="w-3 h-3" /> {swapBusy ? 'Menukar…' : `Tukar ${swapForm.scope === 'RESPONSIBLE' ? 'penanggung' : 'tuan rumah'}`}
                                </button>
                              </div>
                            </div>
                          )}

                          {condOpen && (
                            <div className="grid sm:grid-cols-2 gap-2 p-2 rounded-xl bg-violet-50 border border-violet-200">
                              <select value={condValue} onChange={(e) => setCondValue(e.target.value)} className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white">
                                <option value="GABUNGAN">Gabungan (lintas-BIPRA / luar jemaat)</option>
                                <option value="LIBUR">Libur (force majeure)</option>
                                <option value="ALIH">Alihkan ke kegiatan lain</option>
                              </select>
                              <input value={condPartner} onChange={(e) => setCondPartner(e.target.value)} placeholder="Label pasangan (mis. Gabungan Remaja) — opsional" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
                              {condValue === 'ALIH' && (
                                <select value={condLinked} onChange={(e) => setCondLinked(e.target.value)} className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white">
                                  <option value="">Event alihan…</option>
                                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                              )}
                              <input value={condNote} onChange={(e) => setCondNote(e.target.value)} placeholder="Catatan (opsional)" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs sm:col-span-2" />
                              <div className="sm:col-span-2 flex justify-end gap-2">
                                {overridesByDate.get(iso) && (
                                  <button type="button" onClick={() => void deleteCond(iso)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50">Hapus (kembali normal)</button>
                                )}
                                <button type="button" onClick={() => setCondDate(null)} className="px-3 py-1.5 rounded-xl text-xs text-[#8C8880]">Batal</button>
                                <button type="button" onClick={() => void saveCond()} disabled={condBusy} className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold disabled:opacity-40">{condBusy ? 'Menyimpan…' : 'Simpan kondisi'}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
