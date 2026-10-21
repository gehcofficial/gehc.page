import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Dices, Eye, EyeOff, Loader2, Pause, Play, Plus, RotateCcw, Save, Sparkles, Swords, Trash2, Users } from 'lucide-react';
import { JURY_CRITERIA, ROUND_STEPS, jurySideScore, roundStepLabel } from '../../lib/session-engine';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand';

type JurySide = { biblika: number; logika: number; teamwork: number; etika: number };
type JuryRow = { name: string; pro: JurySide; kontra: JurySide };
type RoundRow = {
  mosi: string;
  pro: string;
  kontra: string;
  proScore: number;
  kontraScore: number;
  jury: JuryRow[];
};
type DebatTeamRow = { name: string; mentor: string; members: string[] };
type TeamRow = { name: string; task: string; members: string[]; done: boolean };

const PHASES = ['brief', 'pro', 'kontra', 'sanggah', 'blow', 'jeda', 'selesai'];

const emptySide = (): JurySide => ({ biblika: 0, logika: 0, teamwork: 0, etika: 0 });
const emptyJury = (name = ''): JuryRow => ({ name, pro: emptySide(), kontra: emptySide() });
const emptyTeam = (): DebatTeamRow => ({ name: '', mentor: '', members: [] });
const emptyRound = (): RoundRow => ({ mosi: '', pro: '', kontra: '', proScore: 0, kontraScore: 0, jury: [] });

async function fetchStage(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal memuat status panggung.');
  return d.session?.config || {};
}

export async function saveStage(sessionId: string, patch: Record<string, unknown>) {
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

/** Editor skor satu sisi juri (4 kriteria berbobot). */
const JurySideInputs: React.FC<{
  label: string;
  side: JurySide;
  onChange: (patch: Partial<JurySide>) => void;
}> = ({ label, side, onChange }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-[#8C8880]">{label} · {jurySideScore(side)}</p>
    <div className="grid grid-cols-4 gap-1">
      {JURY_CRITERIA.map((c) => (
        <label key={c.key} className="text-[9px] font-bold text-[#8C8880]">
          {c.label.split(' ')[0]}
          <input
            type="number"
            min={0}
            max={c.weight}
            value={side[c.key as keyof JurySide]}
            onChange={(e) => onChange({ [c.key]: Math.min(c.weight, Math.max(0, Number(e.target.value) || 0)) } as Partial<JurySide>)}
            className="w-full rounded-lg border border-[#D9D7D0] px-1.5 py-1 text-xs"
          />
        </label>
      ))}
    </div>
  </div>
);

/**
 * Panel ronde debat: 11 langkah bertimer + lembar juri 4-kriteria berbobot,
 * tim PRO/KONTRA (undian H-1), dan Trap Reveal. Skor PRO/KONTRA dihitung
 * otomatis dari lembar juri (bila juri terisi); else input manual (sesi lama).
 */
export const DebatPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [rounds, setRounds] = useState<RoundRow[]>([emptyRound()]);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState('brief');
  const [step, setStep] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState<string | null>(null);
  const [stepSeconds, setStepSeconds] = useState(ROUND_STEPS[0].seconds);
  const [stepShowOnScreen, setStepShowOnScreen] = useState(true);
  const [teams, setTeams] = useState<{ pro: DebatTeamRow; kontra: DebatTeamRow }>({ pro: emptyTeam(), kontra: emptyTeam() });
  const [trapReveal, setTrapReveal] = useState('');
  const [openJury, setOpenJury] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      const st = cfg.rounds || {};
      const draftMosi = (n: number) => String(cfg.draft?.mosi?.[`mosi-${n}`] || '');
      const list: RoundRow[] = Array.isArray(st.rounds) && st.rounds.length
        ? st.rounds.map((r: RoundRow) => ({
            mosi: String(r?.mosi || ''),
            pro: String(r?.pro || ''),
            kontra: String(r?.kontra || ''),
            proScore: Number(r?.proScore) || 0,
            kontraScore: Number(r?.kontraScore) || 0,
            jury: (Array.isArray(r?.jury) ? r.jury : []).map((j: JuryRow) => ({
              name: String(j?.name || ''),
              pro: { ...emptySide(), ...(j?.pro || {}) },
              kontra: { ...emptySide(), ...(j?.kontra || {}) },
            })),
          }))
        : cfg.draft
          ? [1, 2, 3, 4, 5].map((n) => ({ ...emptyRound(), mosi: draftMosi(n) }))
          : [];
      setRounds(list.length ? list : [emptyRound()]);
      setCurrent(Number(st.current) || 0);
      setPhase(String(st.phase || 'brief'));
      const s = Math.min(ROUND_STEPS.length - 1, Math.max(0, Number(st.step) || 0));
      setStep(s);
      setStepStartedAt(st.stepStartedAt ? String(st.stepStartedAt) : null);
      setStepSeconds(Number(st.stepSeconds) || ROUND_STEPS[s].seconds);
      setStepShowOnScreen(st.stepShowOnScreen === undefined ? true : !!st.stepShowOnScreen);
      const tk = st.teams && typeof st.teams === 'object' ? st.teams : {};
      setTeams({
        pro: { ...emptyTeam(), ...(tk.pro || {}), members: Array.isArray(tk.pro?.members) ? tk.pro.members : [] },
        kontra: { ...emptyTeam(), ...(tk.kontra || {}), members: Array.isArray(tk.kontra?.members) ? tk.kontra.members : [] },
      });
      setTrapReveal(String(st.trapReveal || cfg.draft?.trap?.['trap-reveal'] || ''));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!stepStartedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [stepStartedAt]);

  const set = (i: number, patch: Partial<RoundRow>) =>
    setRounds((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setJury = (i: number, j: number, patch: Partial<JuryRow>) =>
    setRounds((prev) => prev.map((r, ri) => (ri === i ? { ...r, jury: r.jury.map((jr, ji) => (ji === j ? { ...jr, ...patch } : jr)) } : r)));
  const setTeam = (side: 'pro' | 'kontra', patch: Partial<DebatTeamRow>) =>
    setTeams((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }));

  const totals = (r: RoundRow) => {
    if (r.jury.length) {
      return {
        pro: r.jury.reduce((n, j) => n + jurySideScore(j.pro), 0),
        kontra: r.jury.reduce((n, j) => n + jurySideScore(j.kontra), 0),
      };
    }
    return { pro: Number(r.proScore) || 0, kontra: Number(r.kontraScore) || 0 };
  };

  const remaining = stepStartedAt
    ? Math.max(0, stepSeconds - Math.floor((now - new Date(stepStartedAt).getTime()) / 1000))
    : stepSeconds;
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  const draw = () => {
    if (Math.random() < 0.5) setTeams((p) => ({ pro: p.kontra, kontra: p.pro }));
    setMsg('Undian H-1 selesai — sisi PRO/KONTRA ditetapkan (tanpa undian ulang).');
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const payload = rounds.map((r) => {
        const t = totals(r);
        return { ...r, proScore: t.pro, kontraScore: t.kontra };
      });
      await saveStage(sessionId, {
        rounds: { rounds: payload, current, phase, step, stepStartedAt, stepSeconds, stepShowOnScreen, teams, trapReveal },
      });
      setMsg('Ronde tersimpan — tampil di peserta & layar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const drawn = Boolean(teams.pro.name.trim() && teams.kontra.name.trim());

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Ronde debat</p>
        <span className="ml-auto text-[11px] font-bold text-[#8C8880]">Langkah {step + 1}/{ROUND_STEPS.length} · {mmss}</span>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        {(['pro', 'kontra'] as const).map((side) => (
          <div key={side} className="rounded-xl border border-[#EFEDE8] p-2 space-y-1.5">
            <p className={`text-[11px] font-black ${side === 'pro' ? 'text-emerald-600' : 'text-rose-600'}`}>{side === 'pro' ? 'PRO' : 'KONTRA'}</p>
            <input value={teams[side].name} onChange={(e) => setTeam(side, { name: e.target.value })} placeholder="Nama tim" className={INPUT} />
            <input value={teams[side].mentor} onChange={(e) => setTeam(side, { mentor: e.target.value })} placeholder="Mentor" className={INPUT} />
            <input value={teams[side].members.join(', ')} onChange={(e) => setTeam(side, { members: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })} placeholder="2 Mentee (pisah koma)" className={INPUT} />
          </div>
        ))}
      </div>
      <button type="button" disabled={drawn} onClick={draw} className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
        <Dices className="w-3.5 h-3.5" /> {drawn ? 'Sisi sudah ditetapkan (undian H-1)' : 'Undi sisi PRO/KONTRA (H-1, acak)'}
      </button>

      <label className="block mt-3">
        <span className="text-[11px] font-bold text-[#8C8880]">Naskah Trap Reveal (konklusi 20′ — bongkar dikotomi palsu)</span>
        <textarea value={trapReveal} onChange={(e) => setTrapReveal(e.target.value)} rows={2} className={`${INPUT} mt-1`} placeholder="Setiap mosi tadi adalah dikotomi palsu …" />
      </label>

      <div className="mt-3 rounded-xl border border-[#EFEDE8] p-2 space-y-2">
        <p className="text-[11px] font-black">Langkah &amp; timer ronde</p>
        <select
          value={step}
          onChange={(e) => {
            const s = Number(e.target.value) || 0;
            setStep(s);
            setStepSeconds(ROUND_STEPS[s].seconds);
            setStepStartedAt(null);
          }}
          className={INPUT}
        >
          {ROUND_STEPS.map((s, i) => (
            <option key={s.key} value={i}>{i + 1}. {roundStepLabel(i)} — {s.seconds / 60 > 1 ? `${s.seconds / 60}′` : `${s.seconds}″`}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setStepStartedAt(new Date().toISOString()); setNow(Date.now()); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
            <Play className="w-3.5 h-3.5" /> Mulai
          </button>
          <button type="button" onClick={() => setStepStartedAt(null)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
          <button type="button" onClick={() => { setStepStartedAt(null); setNow(Date.now()); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs font-bold">
            Durasi
            <input type="number" min={10} max={7200} value={stepSeconds} onChange={(e) => setStepSeconds(Math.max(10, Number(e.target.value) || 10))} className="w-24 rounded-xl border border-[#D9D7D0] px-2 py-2 text-sm" />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs font-bold">
            <input type="checkbox" checked={stepShowOnScreen} onChange={(e) => setStepShowOnScreen(e.target.checked)} className="w-4 h-4" />
            Tampil di layar
          </label>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rounds.map((r, i) => {
          const t = totals(r);
          return (
            <div key={i} className={`rounded-xl border p-3 space-y-2 ${i === current ? 'border-brand bg-brand/5' : 'border-[#EFEDE8]'}`}>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black">Ronde {i + 1}</p>
                <span className="ml-auto text-[11px] font-bold text-[#8C8880]">PRO {t.pro} : {t.kontra} KONTRA</span>
              </div>
              <textarea value={r.mosi} onChange={(e) => set(i, { mosi: e.target.value })} placeholder="Mosi (dikotomi palsu)…" rows={2} className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input value={r.pro} onChange={(e) => set(i, { pro: e.target.value })} placeholder="Tim PRO" className={INPUT} />
                <input value={r.kontra} onChange={(e) => set(i, { kontra: e.target.value })} placeholder="Tim KONTRA" className={INPUT} />
                {!r.jury.length && (
                  <>
                    <input value={r.proScore} onChange={(e) => set(i, { proScore: Number(e.target.value) || 0 })} type="number" min={0} placeholder="Skor PRO" className={INPUT} />
                    <input value={r.kontraScore} onChange={(e) => set(i, { kontraScore: Number(e.target.value) || 0 })} type="number" min={0} placeholder="Skor KONTRA" className={INPUT} />
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { set(i, { jury: [...r.jury, emptyJury()] }); setOpenJury(i); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Juri
                </button>
                <button type="button" onClick={() => setOpenJury((v) => (v === i ? null : i))} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
                  {openJury === i ? 'Tutup lembar juri' : `Lembar juri (${r.jury.length})`}
                </button>
              </div>
              {openJury === i && (
                <div className="space-y-2">
                  {r.jury.map((jr, j) => (
                    <div key={j} className="rounded-xl border border-[#EFEDE8] p-2 space-y-2">
                      <div className="flex gap-2">
                        <input value={jr.name} onChange={(e) => setJury(i, j, { name: e.target.value })} placeholder={`Nama juri ${j + 1}`} className={INPUT} />
                        <button type="button" onClick={() => set(i, { jury: r.jury.filter((_, k) => k !== j) })} className="shrink-0 px-2 text-red-500" title="Hapus juri">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <JurySideInputs label="PRO" side={jr.pro} onChange={(patch) => setJury(i, j, { pro: { ...jr.pro, ...patch } })} />
                        <JurySideInputs label="KONTRA" side={jr.kontra} onChange={(patch) => setJury(i, j, { kontra: { ...jr.kontra, ...patch } })} />
                      </div>
                    </div>
                  ))}
                  {!r.jury.length && <p className="text-[11px] text-[#8C8880]">Belum ada juri — tambah untuk penilaian berbobot (biblika 40 · logika 30 · teamwork 20 · etika 10).</p>}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {rounds.length < 5 && (
            <button type="button" onClick={() => setRounds((p) => [...p, emptyRound()])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
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

/** Panel pemutaran film: judul + durasi + pengumuman pre-roll + tombol mulai/henti. */
export const ScreeningPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState(91);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [preShow, setPreShow] = useState('');

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      // Fallback ke judul draf (Terapkan lama tak menulis screening) — aturan
      // parse sama dengan server: angka 2–3 digit sebelum "menit".
      const draftTitle = String(cfg.draft?.film?.['film-title'] || '').trim();
      setTitle(String(cfg.screening?.title || draftTitle || ''));
      const m = String(cfg.screening?.title ? '' : draftTitle).match(/(\d{2,3})\s*menit/i);
      setDurationMin(Number(cfg.screening?.durationMin) || (m ? Math.min(180, Math.max(10, Number(m[1]))) : 91));
      setStartedAt(cfg.screening?.startedAt || null);
      setPreShow(Array.isArray(cfg.screening?.preShow) ? cfg.screening.preShow.join('\n') : '');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const preShowLines = () =>
    preShow
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await saveStage(sessionId, { screening: { ...patch, preShow: preShowLines() } });
      setStartedAt(d.screening?.startedAt || null);
      setMsg(patch.startedAt ? 'Pemutaran dimulai — layar mode tenang (tanpa countdown).' : 'Tersimpan.');
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
      <label className="block mt-2">
        <span className="text-[11px] font-bold text-[#8C8880]">
          Pengumuman tambahan di layar tunggu (1 baris = 1 pengumuman, maks 6 — mis. info konsumsi)
        </span>
        <textarea
          value={preShow}
          onChange={(e) => setPreShow(e.target.value)}
          rows={3}
          maxLength={6 * 141}
          placeholder={'Tuan rumah membagikan konsumsi selama sesi\nSelamat datang, silakan duduk manis'}
          className={`${INPUT} mt-1 resize-y`}
        />
      </label>
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

/* ---------------------------------- Creative Lab ---------------------------------- */

type LabTeamRow = {
  name: string;
  task: string;
  members: string[];
  done: boolean;
  scribe: string;
  station: string;
  pot: string[];
  bag: string[];
};

type LabActivity = {
  phase: 'IDLE' | 'A1' | 'A2' | 'PRESENT' | 'DONE';
  startedAt: string | null;
  durationSec: number;
  showOnScreen: boolean;
  cardIndex: number;
  presentIndex: number;
  presentStartedAt: string | null;
  presentSeconds: number;
  durations: { A1: number; A2: number; PRESENT: number };
};

const LAB_JAR_TITLES = [
  'A Root I Carry',
  'A Truth I Need to Remember',
  'When I Feel Lost',
  'A Word for My Community',
  'A Verse to Hold Onto',
  'My Next Faith Step',
];

const labEmptyTeam = (): LabTeamRow => ({
  name: '',
  task: '',
  members: [],
  done: false,
  scribe: '',
  station: '',
  pot: [],
  bag: [],
});

const labDefaultActivity = (): LabActivity => ({
  phase: 'IDLE',
  startedAt: null,
  durationSec: 900,
  showOnScreen: true,
  cardIndex: 0,
  presentIndex: 0,
  presentStartedAt: null,
  presentSeconds: 120,
  durations: { A1: 900, A2: 1500, PRESENT: 120 },
});

function useLabTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function fmtLabClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Panel hari-H Creative Lab: papan kelompok (koordinator, juru digital, Tim
 * Pot/Tas), timer A1/A2/presentasi (display-only), navigator kartu jar untuk
 * layar, dan penanda kelompok yang sedang presentasi. Tanpa migrasi skema.
 */
export const ActivityPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [teams, setTeams] = useState<LabTeamRow[]>([labEmptyTeam()]);
  const [activity, setActivity] = useState<LabActivity>(labDefaultActivity());
  const [cards, setCards] = useState<Array<{ title: string; direction: string }>>(
    LAB_JAR_TITLES.map((title) => ({ title, direction: '' })),
  );
  const [loading, setLoading] = useState(true);
  const now = useLabTick(Boolean(activity.startedAt || activity.presentStartedAt));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchStage(sessionId);
      const list: LabTeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list.map((t: LabTeamRow) => ({ ...labEmptyTeam(), ...t })) : [labEmptyTeam()]);
      const a = cfg.activity && typeof cfg.activity === 'object' ? cfg.activity : {};
      const dur = a.durations && typeof a.durations === 'object' ? a.durations : {};
      setActivity({
        phase: ['IDLE', 'A1', 'A2', 'PRESENT', 'DONE'].includes(String(a.phase || '').toUpperCase())
          ? String(a.phase).toUpperCase() as LabActivity['phase']
          : 'IDLE',
        startedAt: a.startedAt || null,
        durationSec: Number(a.durationSec) || Number(dur.A1) || 900,
        showOnScreen: a.showOnScreen !== false,
        cardIndex: Math.min(5, Math.max(0, Number(a.cardIndex) || 0)),
        presentIndex: Math.min(7, Math.max(0, Number(a.presentIndex) || 0)),
        presentStartedAt: a.presentStartedAt || null,
        presentSeconds: Number(a.presentSeconds) || Number(dur.PRESENT) || 120,
        durations: {
          A1: Number(dur.A1) || 900,
          A2: Number(dur.A2) || 1500,
          PRESENT: Number(dur.PRESENT) || Number(a.presentSeconds) || 120,
        },
      });
      const jar = cfg.draft?.jar && typeof cfg.draft.jar === 'object' ? cfg.draft.jar : {};
      setCards(
        LAB_JAR_TITLES.map((title, i) => ({
          title,
          direction: String(jar[`jar-${['root', 'truth', 'lost', 'community', 'verse', 'step'][i]}`] || '').trim(),
        })),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const setTeam = (i: number, patch: Partial<LabTeamRow>) =>
    setTeams((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const saveTeams = async () => {
    const named = teams.filter((t) => t.name.trim());
    if (!named.length) {
      setMsg('Minimal satu kelompok bernama.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await saveStage(sessionId, { teams: { teams: named } });
      const cfg = await fetchStage(sessionId);
      const list: LabTeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list.map((t: LabTeamRow) => ({ ...labEmptyTeam(), ...t })) : [labEmptyTeam()]);
      setMsg('Papan kelompok tersimpan — tampil di peserta & layar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const pushActivity = async (patch: Partial<LabActivity>, note?: string) => {
    const next: LabActivity = { ...activity, ...patch, durations: { ...activity.durations, ...(patch.durations || {}) } };
    setActivity(next);
    setBusy(true);
    setMsg(null);
    try {
      await saveStage(sessionId, { activity: next });
      if (note) setMsg(note);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan status.');
    } finally {
      setBusy(false);
    }
  };

  const startPhase = (phase: 'A1' | 'A2') => {
    const startedAt = new Date().toISOString();
    const seconds = phase === 'A1' ? activity.durations.A1 : activity.durations.A2;
    void pushActivity(
      { phase, startedAt, durationSec: seconds, presentStartedAt: null },
      phase === 'A1' ? 'Activity 1 berjalan — jar + input kartu.' : 'Activity 2 berjalan — Tim Pot dan Tim Tas paralel.',
    );
  };

  const startPresent = () => {
    const startedAt = new Date().toISOString();
    void pushActivity(
      { phase: 'PRESENT', startedAt, presentStartedAt: startedAt, durationSec: activity.presentSeconds, presentIndex: activity.presentIndex },
      'Presentasi dimulai.',
    );
  };

  const nextGroup = () => {
    const count = teams.filter((t) => t.name.trim()).length;
    const next = activity.presentIndex + 1;
    if (next >= Math.max(1, count)) {
      void pushActivity(
        { phase: 'DONE', startedAt: null, presentStartedAt: null, presentIndex: Math.max(0, count - 1) },
        'Semua kelompok presentasi — lanjut refleksi/konklusi.',
      );
      return;
    }
    const startedAt = new Date().toISOString();
    void pushActivity({ phase: 'PRESENT', startedAt, presentStartedAt: startedAt, presentIndex: next }, `Giliran kelompok ${next + 1}.`);
  };

  const stopTimer = () => {
    void pushActivity({ startedAt: null, presentStartedAt: null }, 'Timer dihentikan (transisi manual).');
  };

  const resetStage = () => {
    void pushActivity(
      { phase: 'IDLE', startedAt: null, presentStartedAt: null, cardIndex: 0, presentIndex: 0 },
      'Timer & panggung direset.',
    );
  };

  const activeCard = cards[activity.cardIndex] || cards[0];
  const remainingMs = (() => {
    if (activity.phase === 'PRESENT' && activity.presentStartedAt) {
      return activity.presentSeconds * 1000 - (now - Date.parse(activity.presentStartedAt));
    }
    if (activity.startedAt) return activity.durationSec * 1000 - (now - Date.parse(activity.startedAt));
    return activity.durationSec * 1000;
  })();
  const phaseLabel =
    activity.phase === 'A1' ? 'Activity 1 · Roots Reminder Jar'
      : activity.phase === 'A2' ? 'Activity 2 · Pot ∥ Tas'
        : activity.phase === 'PRESENT' ? 'Presentasi kelompok'
          : activity.phase === 'DONE' ? 'Selesai — refleksi' : 'Belum mulai';

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Creative Lab</p>
        <span className="ml-auto text-[11px] font-bold text-[#8C8880]">{phaseLabel}</span>
      </div>
      {loading ? (
        <p className="mt-2 text-[11px] text-[#8C8880] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat…</p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#1B1B1B] px-4 py-3 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
                {activity.phase === 'PRESENT' ? `Kelompok ${Math.min(teams.length, activity.presentIndex + 1)} / ${Math.max(1, teams.filter((t) => t.name.trim()).length)}` : 'Timer fase'}
              </p>
              <p className="font-mono text-3xl font-black leading-none">{fmtLabClock(remainingMs)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <button type="button" disabled={busy} onClick={() => startPhase('A1')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold disabled:opacity-60">A1</button>
              <button type="button" disabled={busy} onClick={() => startPhase('A2')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold disabled:opacity-60">A2</button>
              <button type="button" disabled={busy} onClick={startPresent} className="px-3 py-1.5 rounded-lg bg-brand text-[11px] font-bold disabled:opacity-60">Presentasi</button>
              <button type="button" disabled={busy} onClick={stopTimer} className="px-3 py-1.5 rounded-lg border border-white/30 text-[11px] font-bold disabled:opacity-60">Stop</button>
              <button type="button" disabled={busy} onClick={resetStage} className="px-3 py-1.5 rounded-lg border border-white/30 text-[11px] font-bold disabled:opacity-60">Reset</button>
            </div>
          </div>

          {activity.phase === 'PRESENT' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#8C8880]">
                Sedang tampil: Kelompok {activity.presentIndex + 1}
                {teams[activity.presentIndex]?.name ? ` — ${teams[activity.presentIndex].name}` : ''}
              </span>
              <button type="button" disabled={busy} onClick={nextGroup} className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
                Kelompok berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="text-[10px] font-bold text-[#8C8880]">
              A1 (menit)
              <input
                type="number" min={1} max={120}
                value={Math.round(activity.durations.A1 / 60)}
                onChange={(e) => setActivity((a) => ({ ...a, durations: { ...a.durations, A1: Math.max(60, Math.min(7200, (Number(e.target.value) || 15) * 60)) } }))}
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="text-[10px] font-bold text-[#8C8880]">
              A2 (menit)
              <input
                type="number" min={1} max={120}
                value={Math.round(activity.durations.A2 / 60)}
                onChange={(e) => setActivity((a) => ({ ...a, durations: { ...a.durations, A2: Math.max(60, Math.min(7200, (Number(e.target.value) || 25) * 60)) } }))}
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="text-[10px] font-bold text-[#8C8880]">
              Presentasi (detik/kelompok)
              <input
                type="number" min={30} max={600}
                value={activity.presentSeconds}
                onChange={(e) => setActivity((a) => ({ ...a, presentSeconds: Math.max(30, Math.min(600, Number(e.target.value) || 120)), durations: { ...a.durations, PRESENT: Math.max(30, Math.min(600, Number(e.target.value) || 120)) } }))}
                className={`${INPUT} mt-1`}
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void pushActivity({ durations: activity.durations }, 'Durasi fase tersimpan.')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
              <Save className="w-3.5 h-3.5" /> Simpan durasi
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pushActivity({ showOnScreen: !activity.showOnScreen }, activity.showOnScreen ? 'Kartu disembunyikan dari layar.' : 'Kartu tampil di layar.')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-60"
            >
              {activity.showOnScreen ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {activity.showOnScreen ? 'Tampil di layar' : 'Disembunyikan'}
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-[#EFEDE8] p-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-[#8C8880]">Kartu jar di layar</p>
              <button type="button" disabled={busy || activity.cardIndex <= 0} onClick={() => void pushActivity({ cardIndex: Math.max(0, activity.cardIndex - 1) })} className="ml-auto p-1 disabled:opacity-40" title="Kartu sebelumnya">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold">{activity.cardIndex + 1} / 6</span>
              <button type="button" disabled={busy || activity.cardIndex >= 5} onClick={() => void pushActivity({ cardIndex: Math.min(5, activity.cardIndex + 1) })} className="p-1 disabled:opacity-40" title="Kartu berikutnya">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-sm font-black">{activeCard?.title || LAB_JAR_TITLES[0]}</p>
            {activeCard?.direction && <p className="text-[11px] text-[#8C8880]">{activeCard.direction}</p>}
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-[#8C8880]">Papan kelompok ({teams.filter((t) => t.name.trim()).length})</p>
              <span className="text-[10px] text-[#8C8880]">5-8 orang · juru digital · Tim Pot/Tas</span>
            </div>
            <div className="mt-2 space-y-2">
              {teams.map((t, i) => (
                <div key={i} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={t.name} onChange={(e) => setTeam(i, { name: e.target.value })} placeholder={`Nama kelompok ${i + 1}`} className={INPUT} />
                    <button type="button" onClick={() => setTeams((p) => p.filter((_, j) => j !== i))} className="shrink-0 px-2 text-red-500" title="Hapus kelompok">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input value={t.station} onChange={(e) => setTeam(i, { station: e.target.value })} placeholder="Meja / stasiun" className={INPUT} />
                    <input value={t.scribe} onChange={(e) => setTeam(i, { scribe: e.target.value })} placeholder="Juru digital (input 6 kartu)" className={INPUT} />
                  </div>
                  <input
                    value={t.members.join(', ')}
                    onChange={(e) => setTeam(i, { members: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })}
                    placeholder="Anggota (pisah koma)"
                    className={INPUT}
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      value={t.pot.join(', ')}
                      onChange={(e) => setTeam(i, { pot: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })}
                      placeholder="Tim Pot — Grow What You Believe"
                      className={INPUT}
                    />
                    <input
                      value={t.bag.join(', ')}
                      onChange={(e) => setTeam(i, { bag: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })}
                      placeholder="Tim Tas — Carry The Gospel"
                      className={INPUT}
                    />
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C8880]">
                    <input type="checkbox" checked={t.done} onChange={(e) => setTeam(i, { done: e.target.checked })} className="w-4 h-4" />
                    Selesai
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {teams.length < 8 && (
                <button type="button" onClick={() => setTeams((p) => [...p, labEmptyTeam()])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Kelompok
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void saveTeams()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan kelompok
              </button>
            </div>
          </div>
        </>
      )}
      {msg && <p className="mt-2 text-[11px] text-[#8C8880]">{msg}</p>}
    </div>
  );
};
