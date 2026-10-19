import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Dices, Loader2, Pause, Play, Plus, RotateCcw, Save, Swords, Trash2, Users } from 'lucide-react';
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
