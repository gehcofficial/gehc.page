import React, { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Scissors,
  GitMerge,
  UserMinus,
  CheckCircle2,
  XCircle,
  BellRing,
  Loader2,
  Users,
} from 'lucide-react';

interface JethroGroup {
  id: string;
  name: string;
  status: string;
  parentId: string | null;
  parentName: string | null;
  foundedPeriod: string | null;
  activeCount: number;
  threshold: number;
  freeSlots: number;
  isFull: boolean;
}

interface NotifCandidate {
  id: string;
  name: string;
  rate: number;
}

interface JethroNotification {
  id: string;
  type: 'IDLE_FLAG' | 'MITOSIS_ALERT' | 'MERGER_SUGGESTION';
  title: string;
  message: string | null;
  groupId: string | null;
  groupName: string | null;
  memberId: string | null;
  memberName: string | null;
  status: string;
  createdAt: string;
  payload: {
    candidates?: NotifCandidate[];
    sourceGroupId?: string;
    sourceName?: string;
    targetGroupId?: string;
    targetName?: string;
    combined?: number;
  } | null;
}

interface Dashboard {
  threshold: number;
  groups: JethroGroup[];
  notifications: JethroNotification[];
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const JethroEngine: React.FC = () => {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placementCount, setPlacementCount] = useState('5');
  const [placementResult, setPlacementResult] = useState<string | null>(null);
  const [splitNames, setSplitNames] = useState<Record<string, { newName: string; m1: string; m2: string }>>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await request<Dashboard>('/api/jethro/dashboard');
      setDash(d);
      setError(null);
      // Prefill form split dari alert mitosis
      const drafts: Record<string, { newName: string; m1: string; m2: string }> = {};
      for (const n of d.notifications.filter((x) => x.type === 'MITOSIS_ALERT' && x.payload?.candidates)) {
        drafts[n.groupId || n.id] = {
          newName: `${n.groupName} Generasi 2`,
          m1: n.payload!.candidates![0]?.id || '',
          m2: n.payload!.candidates![1]?.id || '',
        };
      }
      setSplitNames(drafts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runScan = async () => {
    setBusy(true);
    try {
      await request('/api/jethro/scan', 'POST');
      await load();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      setPlacementResult(okMsg);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const runPlacement = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await request<{
        requested: number;
        assigned: number;
        unplaced: number;
        plan: { assign: number; groupName: string }[];
      }>(`/api/jethro/placement?count=${encodeURIComponent(placementCount)}`);
      setPlacementResult(
        r.plan.length
          ? `Rekomendasi ${r.assigned}/${r.requested} newcomer: ` +
              r.plan.map((p) => `${p.assign} ke ${p.groupName}`).join(', ') +
              (r.unplaced ? ` (tidak tertampung: ${r.unplaced})` : '')
          : 'Tidak ada slot kosong — pertimbangkan split grup.'
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runNarrate = async () => {
    setAiBusy(true);
    try {
      const r = await request<{ summary: string }>('/api/jethro/narrate');
      setAiSummary(r.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  if (error && !dash) {
    return (
      <div className="bg-white rounded-3xl border border-[#D9D7D0]/60 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">Jethro Engine tidak tersedia</h3>
            <p className="text-xs text-[#8C8880] mt-1">{error}</p>
            <p className="text-xs text-[#8C8880] mt-2">
              Pastikan API server berjalan (<code>npm run server</code>) dan kamu login via Google
              dengan role KOMISI / COMMITTEE / SUPERADMIN / BPMJ (baca-saja).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#8C8880] p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat dasbor Jethro…
      </div>
    );
  }

  const idleFlags = dash.notifications.filter((n) => n.type === 'IDLE_FLAG');
  const mitosis = dash.notifications.filter((n) => n.type === 'MITOSIS_ALERT');
  const mergers = dash.notifications.filter((n) => n.type === 'MERGER_SUGGESTION');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Jethro Engine</h2>
          </div>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Decision support regenerasi kelompok — ambang {dash.threshold} anggota aktif per grup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Jalankan Analisis
          </button>
          <button
            onClick={runNarrate}
            disabled={aiBusy}
            className="px-4 py-2 rounded-xl border-2 border-[#181818] text-xs font-bold flex items-center gap-2 hover:bg-[#FAF9F5] disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiBusy ? 'animate-pulse' : ''}`} />
            Narasi AI
          </button>
        </div>
      </div>

      {aiSummary && (
        <div className="bg-gradient-to-br from-[#181818] to-[#2A2A2A] rounded-3xl p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Ringkasan Eksekutif — Jethro AI
          </p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-white/90">{aiSummary}</p>
        </div>
      )}

      {(error || placementResult) && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-semibold ${
            error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {error || placementResult}
        </div>
      )}

      {/* Kapasitas Grup */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {dash.groups.map((g) => (
          <div key={g.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black truncate">{g.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${g.isFull ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {g.activeCount}/{g.threshold}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${g.isFull ? 'bg-red-500' : g.activeCount / g.threshold > 0.7 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (g.activeCount / g.threshold) * 100)}%` }}
              />
            </div>
            {g.parentName && <p className="text-[9px] text-[#8C8880] mt-1.5">anak dari {g.parentName}</p>}
          </div>
        ))}
      </div>

      {/* Placement Recommender */}
      <div className="bg-white rounded-3xl border border-[#D9D7D0]/60 p-5">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-[#FF416C]" /> Placement Recommender
        </h3>
        <p className="text-xs text-[#8C8880] mt-1">Distribusi newcomer otomatis ke slot kosong grup.</p>
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min={1}
            max={500}
            value={placementCount}
            onChange={(e) => setPlacementCount(e.target.value)}
            className="w-24 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold"
          />
          <span className="text-xs text-[#8C8880]">newcomer</span>
          <button
            onClick={runPlacement}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:bg-gray-100 text-xs font-bold disabled:opacity-50"
          >
            Rekomendasikan
          </button>
        </div>
      </div>

      {/* Mitosis Alerts */}
      {mitosis.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Scissors className="w-4 h-4 text-red-500" /> Trigger Pembelahan ({mitosis.length})
          </h3>
          {mitosis.map((n) => {
            const draftKey = n.groupId || n.id;
            const draft = splitNames[draftKey];
            return (
              <div key={n.id} className="bg-white rounded-3xl border border-red-200 p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black">{n.title}</p>
                    <p className="text-xs text-[#8C8880] mt-1">{n.message}</p>
                  </div>
                  <button
                    onClick={() => act(() => request(`/api/db/notifications/${n.id}`, 'PATCH', { status: 'RESOLVED' }), 'Alert ditutup.')}
                    className="text-[10px] font-bold text-[#8C8880] hover:text-[#1B1B1B] shrink-0"
                  >
                    Abaikan
                  </button>
                </div>
                {draft && (
                  <div className="grid sm:grid-cols-4 gap-2 items-end">
                    <input
                      value={draft.newName}
                      onChange={(e) => setSplitNames({ ...splitNames, [draftKey]: { ...draft, newName: e.target.value } })}
                      placeholder="Nama grup baru"
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold"
                    />
                    <select
                      value={draft.m1}
                      onChange={(e) => setSplitNames({ ...splitNames, [draftKey]: { ...draft, m1: e.target.value } })}
                      className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold"
                    >
                      {n.payload?.candidates?.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.rate}%)</option>
                      ))}
                    </select>
                    <select
                      value={draft.m2}
                      onChange={(e) => setSplitNames({ ...splitNames, [draftKey]: { ...draft, m2: e.target.value } })}
                      className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold"
                    >
                      {n.payload?.candidates?.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.rate}%)</option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        act(
                          () =>
                            request('/api/jethro/split', 'POST', {
                              groupId: n.groupId,
                              newName: draft.newName,
                              mentorMemberId: draft.m1,
                              comentorMemberId: draft.m2,
                            }),
                          'Grup baru berhasil dibuka.'
                        )
                      }
                      disabled={busy || !draft.newName.trim() || draft.m1 === draft.m2}
                      className="sm:col-span-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold disabled:opacity-50"
                    >
                      Promote & Buka Grup Baru
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Merger Suggestions */}
      {mergers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-purple-600" /> Saran Merger ({mergers.length})
          </h3>
          {mergers.map((n) => (
            <div key={n.id} className="bg-white rounded-3xl border border-purple-200 p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black">{n.title}</p>
                <p className="text-xs text-[#8C8880] mt-1">{n.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    act(
                      () =>
                        request('/api/jethro/merge', 'POST', {
                          sourceGroupId: n.payload?.sourceGroupId ?? n.groupId,
                          targetGroupId: n.payload?.targetGroupId,
                        }),
                      'Merger selesai.'
                    )
                  }
                  disabled={busy}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  Gabungkan
                </button>
                <button
                  onClick={() => act(() => request(`/api/db/notifications/${n.id}`, 'PATCH', { status: 'RESOLVED' }), 'Saran ditutup.')}
                  className="text-[10px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
                >
                  Abaikan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Idle Flags */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <BellRing className="w-4 h-4 text-amber-500" /> Auto-Flag Idle ({idleFlags.length})
        </h3>
        {idleFlags.length === 0 && (
          <p className="text-xs text-[#8C8880] bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
            Tidak ada anggota idle. Jalankan analisis berkala setelah laporan pertemuan masuk.
          </p>
        )}
        {idleFlags.map((n) => (
          <div key={n.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{n.memberName} <span className="text-[#8C8880] font-medium">· {n.groupName}</span></p>
              <p className="text-[11px] text-[#8C8880] truncate">{n.message}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {n.memberId && (
                <>
                  <button
                    title="Transisi ke ALUMNI (keluar dari kapasitas aktif)"
                    onClick={() => act(() => request(`/api/jethro/member/${n.memberId}/alumni`, 'PATCH', { note: 'Auto-flag idle' }), `${n.memberName} menjadi ALUMNI.`)}
                    disabled={busy}
                    className="p-2 rounded-xl hover:bg-amber-50 text-amber-600 disabled:opacity-50"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                  <button
                    title="Tandai sudah di-follow up (ACKNOWLEDGED)"
                    onClick={() => act(() => request(`/api/db/notifications/${n.id}`, 'PATCH', { status: 'ACKNOWLEDGED' }), 'Flag ditandai dilihat.')}
                    disabled={busy}
                    className="p-2 rounded-xl hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                title="Tutup tanpa tindakan"
                onClick={() => act(() => request(`/api/db/notifications/${n.id}`, 'PATCH', { status: 'RESOLVED' }), 'Flag ditutup.')}
                disabled={busy}
                className="p-2 rounded-xl hover:bg-gray-100 text-[#8C8880] disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
