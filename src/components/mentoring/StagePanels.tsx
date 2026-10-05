import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Loader2, Plus, Save, Swords, Trash2, Users } from 'lucide-react';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand';

type RoundRow = { mosi: string; pro: string; kontra: string; proScore: number; kontraScore: number };
type TeamRow = { name: string; task: string; members: string[]; done: boolean };

const PHASES = ['brief', 'pro', 'kontra', 'sanggah', 'blow', 'jeda', 'selesai'];

async function fetchStage(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal memuat status panggung.');
  return d.session?.config || {};
}

async function saveStage(sessionId: string, patch: Record<string, unknown>) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/stage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan.');
  return d;
}

function useStageMsg() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return { msg, setMsg, busy, setBusy };
}

/** Panel ronde debat: editor mosi, ronde aktif, fase, skor juri. */
export const DebatPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState('brief');

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      const st = cfg.rounds || {};
      const list: RoundRow[] = Array.isArray(st.rounds) && st.rounds.length
        ? st.rounds
        : (cfg.draft ? [1, 2, 3, 4, 5].map((n) => ({
            mosi: String(cfg.draft?.mosi?.[`mosi-${n}`] || ''),
            pro: '', kontra: '', proScore: 0, kontraScore: 0,
          })) : []);
      setRounds(list.length ? list : [{ mosi: '', pro: '', kontra: '', proScore: 0, kontraScore: 0 }]);
      setCurrent(Number(st.current) || 0);
      setPhase(String(st.phase || 'brief'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (i: number, patch: Partial<RoundRow>) =>
    setRounds((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveStage(sessionId, { rounds: { rounds, current, phase } });
      setMsg('Ronde tersimpan — tampil di peserta & layar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Ronde debat</p>
      </div>
      <div className="mt-3 space-y-2">
        {rounds.map((r, i) => (
          <div key={i} className={`rounded-xl border p-3 space-y-2 ${i === current ? 'border-brand bg-brand/5' : 'border-[#EFEDE8]'}`}>
            <p className="text-[11px] font-black">Ronde {i + 1}</p>
            <textarea value={r.mosi} onChange={(e) => set(i, { mosi: e.target.value })} placeholder="Mosi (dikotomi palsu)…" rows={2} className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <input value={r.pro} onChange={(e) => set(i, { pro: e.target.value })} placeholder="Tim PRO" className={INPUT} />
              <input value={r.kontra} onChange={(e) => set(i, { kontra: e.target.value })} placeholder="Tim KONTRA" className={INPUT} />
              <input value={r.proScore} onChange={(e) => set(i, { proScore: Number(e.target.value) || 0 })} type="number" min={0} placeholder="Skor PRO" className={INPUT} />
              <input value={r.kontraScore} onChange={(e) => set(i, { kontraScore: Number(e.target.value) || 0 })} type="number" min={0} placeholder="Skor KONTRA" className={INPUT} />
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {rounds.length < 5 && (
            <button type="button" onClick={() => setRounds((p) => [...p, { mosi: '', pro: '', kontra: '', proScore: 0, kontraScore: 0 }])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Ronde
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs font-bold">
            Aktif
            <input value={current + 1} onChange={(e) => setCurrent(Math.max(0, Math.min(rounds.length - 1, (Number(e.target.value) || 1) - 1)))} type="number" min={1} max={rounds.length} className="w-16 rounded-xl border border-[#D9D7D0] px-2 py-2 text-sm" />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs font-bold">
            Fase
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="rounded-xl border border-[#D9D7D0] px-2 py-2 text-sm">
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan ronde
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-[11px] text-[#8C8880]">{msg}</p>}
    </div>
  );
};

/** Panel pemutaran film: judul + durasi + tombol mulai/henti. */
export const ScreeningPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState(91);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      setTitle(String(cfg.screening?.title || ''));
      setDurationMin(Number(cfg.screening?.durationMin) || 91);
      setStartedAt(cfg.screening?.startedAt || null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await saveStage(sessionId, { screening: patch });
      setStartedAt(d.screening?.startedAt || null);
      setMsg(patch.startedAt ? 'Pemutaran dimulai — countdown jalan di layar.' : 'Tersimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Clapperboard className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Pemutaran film</p>
        {startedAt && <span className="ml-auto text-[11px] font-bold text-emerald-600">● Tayang</span>}
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul film" className={INPUT} />
        <input value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 91)} type="number" min={10} max={180} placeholder="Durasi (menit)" className={INPUT} />
      </div>
      <div className="mt-2 flex gap-2">
        {!startedAt ? (
          <button type="button" disabled={busy || !title.trim()} onClick={() => void save({ title: title.trim(), durationMin, startedAt: new Date().toISOString() })} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-60">
            {busy ? '…' : '▶ Mulai putar'}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void save({ title: title.trim(), durationMin, startedAt: null })} className="px-4 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880] disabled:opacity-60">
            Hentikan penanda
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void save({ title: title.trim(), durationMin, startedAt })} className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
          Simpan
        </button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-[#8C8880]">{msg}</p>}
    </div>
  );
};

/** Panel tim misi: susun tim + anggota + tandai selesai. */
export const TeamsPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      const list: TeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list : [{ name: '', task: '', members: [], done: false }]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (i: number, patch: Partial<TeamRow>) =>
    setTeams((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveStage(sessionId, { teams: { teams } });
      setMsg('Papan tim tersimpan — tampil di peserta & layar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Tim misi</p>
      </div>
      <div className="mt-3 space-y-2">
        {teams.map((t, i) => (
          <div key={i} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
            <div className="flex gap-2">
              <input value={t.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nama tim" className={INPUT} />
              <button type="button" onClick={() => setTeams((p) => p.filter((_, j) => j !== i))} className="shrink-0 px-2 text-red-500" title="Hapus tim">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input value={t.task} onChange={(e) => set(i, { task: e.target.value })} placeholder="Tugas tim" className={INPUT} />
            <input
              value={t.members.join(', ')}
              onChange={(e) => set(i, { members: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })}
              placeholder="Anggota (pisah koma)"
              className={INPUT}
            />
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C8880]">
              <input type="checkbox" checked={t.done} onChange={(e) => set(i, { done: e.target.checked })} className="w-4 h-4" />
              Selesai
            </label>
          </div>
        ))}
        <div className="flex gap-2">
          {teams.length < 8 && (
            <button type="button" onClick={() => setTeams((p) => [...p, { name: '', task: '', members: [], done: false }])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Tim
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan tim
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-[11px] text-[#8C8880]">{msg}</p>}
    </div>
  );
};
