import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Dices, Eye, EyeOff, ImagePlus, Loader2, Pause, Play, Plus, RotateCcw, Save, Sparkles, Swords, Trash2, Users, X } from 'lucide-react';
import { JURY_CRITERIA, ROUND_STEPS, jurySideScore, roundStepLabel } from '../../lib/session-engine';
import { BEYONDERS_GROUPS, LAB_PHOTO_CAP, LAB_PRESENT_SLIDES, LAB_STATION_CAP, MISSION_INTERNAL_ROLES, MISSION_TEAM_CAP, defaultJointTeams, stepLabPresentation } from '../../lib/mentoring';
import { labPresentationOrder } from '../../lib/creative-lab-draft';

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
type TeamRow = { name: string; task: string; members: string[]; done: boolean; pair?: string[]; roles?: string };

const PHASES = ['brief', 'pro', 'kontra', 'sanggah', 'blow', 'jeda', 'selesai'];

const emptySide = (): JurySide => ({ biblika: 0, logika: 0, teamwork: 0, etika: 0 });
const emptyJury = (name = ''): JuryRow => ({ name, pro: emptySide(), kontra: emptySide() });
const emptyTeam = (): DebatTeamRow => ({ name: '', mentor: '', members: [] });
const emptyRound = (): RoundRow => ({ mosi: '', pro: '', kontra: '', proScore: 0, kontraScore: 0, jury: [] });

async function fetchStage(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal memuat status panggung.');
  const config = d.session?.config || {};
  // Panel Creative Lab butuh ringkasan update/foto kelompok; panel lain mengabaikan.
  return { ...config, lab: d.lab || null, session: d.session || null };
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

/** Panel Mission Sequence: 5 tim gabungan. Tim lama tidak ditimpa sampai tombol default ditekan. */
export const TeamsPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { msg, setMsg, busy, setBusy } = useStageMsg();
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const load = useCallback(async () => {
    try {
      const cfg = await fetchStage(sessionId);
      const list: TeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list.map((t) => ({ ...t, pair: Array.isArray(t.pair) ? t.pair : [], roles: t.roles || '' })) : [{ name: '', task: '', members: [], done: false, pair: [], roles: '' }]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (i: number, patch: Partial<TeamRow>) =>
    setTeams((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const setPair = (i: number, slot: 0 | 1, value: string) => {
    setTeams((prev) => prev.map((t, j) => {
      if (j !== i) return t;
      const pair = [t.pair?.[0] || '', t.pair?.[1] || ''];
      pair[slot] = value;
      const named = pair.filter(Boolean);
      return { ...t, pair, name: named.length ? named.join(' & ') : t.name };
    }));
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await saveStage(sessionId, { teams: { teams: teams.slice(0, MISSION_TEAM_CAP) } });
      setMsg('Papan tim gabungan tersimpan — tampil di peserta dan layar.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const loadDefault = () => {
    if (teams.some((t) => t.name.trim()) && !window.confirm('Ganti papan yang tersimpan dengan 5 pasangan default? Tim lama tidak berubah sebelum kamu menekan Simpan tim.')) return;
    setTeams(defaultJointTeams());
    setMsg('Pasangan default dimuat di layar ini. Tekan Simpan tim agar tersimpan.');
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Tim gabungan</p>
        <span className="ml-auto text-[10px] font-bold text-[#8C8880]">{teams.length}/{MISSION_TEAM_CAP}</span>
      </div>
      <p className="mt-1 text-[10px] text-[#8C8880] leading-relaxed">
        Lima tim, masing-masing dua kelompok mentoring. Tiap tim menjalankan seluruh misi. Peran lama hanya saran di dalam tim. Papan yang sudah tersimpan tidak diganti otomatis.
      </p>
      <div className="mt-3 space-y-2">
        {teams.map((t, i) => (
          <div key={i} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
            <div className="flex gap-2">
              <input value={t.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nama tim" className={INPUT} />
              <button type="button" onClick={() => setTeams((p) => p.filter((_, j) => j !== i))} className="shrink-0 px-2 text-red-500" title="Hapus tim">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[0, 1].map((slot) => (
                <select key={slot} value={t.pair?.[slot] || ''} onChange={(e) => setPair(i, slot as 0 | 1, e.target.value)} className={INPUT}>
                  <option value="">{slot === 0 ? 'Kelompok A…' : 'Kelompok B…'}</option>
                  {BEYONDERS_GROUPS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {t.pair?.[slot] && !BEYONDERS_GROUPS.includes(t.pair[slot] as typeof BEYONDERS_GROUPS[number]) && (
                    <option value={t.pair[slot]}>{t.pair[slot]}</option>
                  )}
                </select>
              ))}
            </div>
            <input value={t.task} onChange={(e) => set(i, { task: e.target.value })} placeholder="Tugas tim" className={INPUT} />
            <textarea
              value={t.roles || ''}
              onChange={(e) => set(i, { roles: e.target.value })}
              rows={2}
              placeholder={MISSION_INTERNAL_ROLES}
              className={`${INPUT} resize-y`}
            />
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
        <div className="flex flex-wrap gap-2">
          {teams.length < MISSION_TEAM_CAP && (
            <button type="button" onClick={() => setTeams((p) => [...p, { name: '', task: 'Menjalankan seluruh misi bersama.', members: [], done: false, pair: [], roles: MISSION_INTERNAL_ROLES }])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Tim
            </button>
          )}
          <button type="button" onClick={loadDefault} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
            Pasangan default
          </button>
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

const LAB_TEAM_CAP = 10;
const LAB_INDEX_MAX = LAB_TEAM_CAP - 1;

type LabTeamRow = {
  name: string;
  task: string;
  members: string[];
  done: boolean;
  scribe: string;
  station: string;
  pot: string[];
  bag: string[];
  repUserId: string;
  repName: string;
  memberUserIds: string[];
  groupId: string;
  missing: boolean;
};

type LabActivity = {
  phase: 'DRAW' | 'IDLE' | 'A1' | 'A2' | 'PRESENT' | 'DONE';
  startedAt: string | null;
  durationSec: number;
  showOnScreen: boolean;
  cardIndex: number;
  presentIndex: number;
  presentSlide: number;
  presentStartedAt: string | null;
  presentSeconds: number;
  presentOrder: number[];
  presentSkipped: number[];
  presentPostponed: number[];
  presentDrawnAt: string | null;
  durations: { A1: number; A2: number; PRESENT: number };
};

type LabParticipant = { id: string; name: string; email?: string | null };
type LabGroupOption = { id: string; name: string; members: LabParticipant[] };
type LabPhotoRow = {
  id: string;
  kind: string;
  body: string;
  progress: number | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  userName?: string;
  createdAt: string | null;
};
type LabTeamSummary = {
  index: number;
  name: string;
  repName: string;
  repUserId: string;
  memberCount: number;
  done: boolean;
  pot: { meaning: string; progress: number | null; photos: LabPhotoRow[] };
  bag: { meaning: string; progress: number | null; photos: LabPhotoRow[] };
  commitment: string;
  groupPhoto: LabPhotoRow | null;
  photoCount: number;
  photoComplete: boolean;
  lastUpdateAt: string | null;
  updateCount: number;
};
type LabSummary = { teams: LabTeamSummary[]; presentOrder: number[] };


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
  repUserId: '',
  repName: '',
  memberUserIds: [],
  groupId: '',
  missing: false,
});

const labDefaultActivity = (): LabActivity => ({
  phase: 'IDLE',
  startedAt: null,
  durationSec: 900,
  showOnScreen: true,
  cardIndex: 0,
  presentIndex: 0,
  presentSlide: 0,
  presentStartedAt: null,
  presentSeconds: 150,
  presentOrder: [],
  presentSkipped: [],
  presentPostponed: [],
  presentDrawnAt: null,
  durations: { A1: 900, A2: 1500, PRESENT: 150 },
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
  const [groupOptions, setGroupOptions] = useState<LabGroupOption[]>([]);
  const [lab, setLab] = useState<LabSummary | null>(null);
  const [uploadSlot, setUploadSlot] = useState<Record<number, 'POT' | 'BAG' | 'GROUP'>>({});
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [savedTeamNames, setSavedTeamNames] = useState('');
  const [participantsReady, setParticipantsReady] = useState(false);
  const [stations, setStations] = useState({ a: 'Pot', b: 'Tas' });
  const [loading, setLoading] = useState(true);
  const now = useLabTick(Boolean(activity.startedAt || activity.presentStartedAt));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchStage(sessionId);
      const list: LabTeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list.map((t: LabTeamRow) => ({ ...labEmptyTeam(), ...t })) : [labEmptyTeam()]);
      setSavedTeamNames((list.length ? list : [labEmptyTeam()]).map((t: LabTeamRow) => t.name.trim()).join('|'));
      const a = cfg.activity && typeof cfg.activity === 'object' ? cfg.activity : {};
      const dur = a.durations && typeof a.durations === 'object' ? a.durations : {};
      setActivity({
        phase: ['DRAW', 'IDLE', 'A1', 'A2', 'PRESENT', 'DONE'].includes(String(a.phase || '').toUpperCase())
          ? String(a.phase).toUpperCase() as LabActivity['phase']
          : 'IDLE',
        startedAt: a.startedAt || null,
        durationSec: Number(a.durationSec) || Number(dur.A1) || 900,
        showOnScreen: a.showOnScreen !== false,
        cardIndex: Math.min(5, Math.max(0, Number(a.cardIndex) || 0)),
        presentIndex: Math.min(LAB_INDEX_MAX, Math.max(0, Number(a.presentIndex) || 0)),
        presentSlide: Math.min(2, Math.max(0, Math.floor(Number(a.presentSlide) || 0))),
        presentStartedAt: a.presentStartedAt || null,
        presentSeconds: Number(a.presentSeconds) || Number(dur.PRESENT) || 150,
        presentOrder: Array.isArray(a.presentOrder) ? a.presentOrder.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= LAB_INDEX_MAX) : [],
        presentSkipped: Array.isArray(a.presentSkipped) ? a.presentSkipped.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= LAB_INDEX_MAX) : [],
        presentPostponed: Array.isArray(a.presentPostponed) ? a.presentPostponed.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= LAB_INDEX_MAX) : [],
        presentDrawnAt: a.presentDrawnAt || null,
        durations: {
          A1: Number(dur.A1) || 900,
          A2: Number(dur.A2) || 1500,
          PRESENT: Number(dur.PRESENT) || Number(a.presentSeconds) || 150,
        },
      });
      setLab(cfg.lab && Array.isArray(cfg.lab.teams) ? cfg.lab as LabSummary : null);
      const a2 = cfg.draft?.['activity-2'] && typeof cfg.draft['activity-2'] === 'object' ? cfg.draft['activity-2'] : {};
      setStations({
        a: String(a2['a2-a-media'] || '').trim() || 'Pot',
        b: String(a2['a2-b-media'] || '').trim() || 'Tas',
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

  const loadParticipants = useCallback(async () => {
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/participants`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat peserta.');
      setGroupOptions(Array.isArray(d.groups) ? d.groups : []);
      setParticipantsReady(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat peserta.');
    }
  }, [sessionId, setMsg]);

  useEffect(() => {
    void load();
    void loadParticipants();
  }, [load, loadParticipants]);

  const setTeam = (i: number, patch: Partial<LabTeamRow>) =>
    setTeams((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const membersOf = (team: LabTeamRow) => {
    if (!team.groupId) return [];
    const group = groupOptions.find((g) => g.id === team.groupId);
    return (group?.members || []).filter((m) => m.id && m.name);
  };
  const presentableIndexes = useMemo(
    () => teams.map((t, i) => (t.name.trim() && !t.missing ? i : -1)).filter((i) => i >= 0),
    [teams],
  );
  const namedTeamCount = presentableIndexes.length;
  const presentationOrder = useMemo(() => {
    const allowed = new Set(presentableIndexes);
    return labPresentationOrder(activity, teams.length).filter((i) => allowed.has(i));
  }, [activity, presentableIndexes, teams.length]);
  const skippedSet = useMemo(() => new Set(activity.presentSkipped), [activity.presentSkipped]);
  const postponedSet = useMemo(() => new Set(activity.presentPostponed), [activity.presentPostponed]);
  const currentTeamIndex = presentationOrder[activity.presentIndex] ?? activity.presentIndex;

  const selectRep = (teamIndex: number, userId: string) => {
    setTeams((prev) => prev.map((t, i) => {
      if (i !== teamIndex) return t;
      const person = membersOf(t).find((m) => m.id === userId);
      const ids = new Set(t.memberUserIds || []);
      if (userId) ids.add(userId);
      return { ...t, repUserId: userId, repName: person?.name || '', memberUserIds: [...ids] };
    }));
  };

  const toggleRole = (teamIndex: number, key: 'pot' | 'bag', name: string) => {
    setTeams((prev) => prev.map((t, i) => {
      if (i !== teamIndex) return t;
      const cur = t[key] || [];
      if (cur.includes(name)) return { ...t, [key]: cur.filter((n) => n !== name) };
      if (cur.length >= LAB_STATION_CAP) return t;
      return { ...t, [key]: [...cur, name] };
    }));
  };

  const loadTenGroups = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/lab/load-groups`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat kelompok.');
      await load();
      const missing = Array.isArray(d.missing) ? d.missing.filter(Boolean) : [];
      const locked = d.orderLocked ? ' Urutan yang sudah punya laporan karya tidak diacak.' : '';
      setMsg(missing.length
        ? `10 kelompok dimuat. Belum ada di database: ${missing.join(', ')}.${locked}`
        : `10 kelompok Beyonders dimuat.${locked}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat kelompok.');
    } finally {
      setBusy(false);
    }
  };

  const drawOrder = () => {
    if (!namedTeamCount) {
      setMsg('Muat 10 kelompok dulu sebelum mengundi.');
      return;
    }
    if (activity.presentOrder.length && !window.confirm('Urutan presentasi sudah ada. Undi ulang dan ganti urutan?')) return;
    const arr = [...presentableIndexes];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    void pushActivity({ presentOrder: arr, presentDrawnAt: new Date().toISOString(), presentIndex: 0, presentSlide: 0 }, 'Urutan presentasi diundi dan tampil di layar.');
  };

  const moveOrder = (index: number, delta: number) => {
    const next = [...presentationOrder];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void pushActivity({ presentOrder: next, presentDrawnAt: new Date().toISOString() }, 'Urutan presentasi disesuaikan manual.');
  };

  const skipAtPos = (pos: number) => {
    const teamIndex = presentationOrder[pos];
    if (teamIndex == null) return;
    const presentSkipped = [...new Set([...activity.presentSkipped, teamIndex])];
    const presentPostponed = activity.presentPostponed.filter((i) => i !== teamIndex);
    void pushActivity({ presentSkipped, presentPostponed }, 'Kelompok dilewati (tidak presentasi).');
  };

  const postponeAtPos = (pos: number) => {
    const teamIndex = presentationOrder[pos];
    if (teamIndex == null) return;
    const presentPostponed = [...new Set([...activity.presentPostponed, teamIndex])];
    const presentOrder = activity.presentOrder.filter((i) => i !== teamIndex);
    void pushActivity({ presentPostponed, presentOrder }, 'Kelompok ditunda — masuk antrian belakang.');
  };

  const reenterPostponed = (teamIndex: number) => {
    const presentPostponed = activity.presentPostponed.filter((i) => i !== teamIndex);
    const presentOrder = [...activity.presentOrder.filter((i) => i !== teamIndex), teamIndex];
    void pushActivity({ presentPostponed, presentOrder }, 'Kelompok ditunda kembali masuk antrian.');
  };

  const releaseLabReactions = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const cfg = await fetchStage(sessionId);
      const votes = cfg.labReactions?.votes && typeof cfg.labReactions.votes === 'object' ? cfg.labReactions.votes : {};
      await saveStage(sessionId, { labReactions: { released: true, votes }, labChipsOpen: true });
      setMsg('Reaksi presentasi dirilis — word cloud & chip Satu Kata terbuka.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal merilis reaksi.');
    } finally {
      setBusy(false);
    }
  };

  const saveTeams = async () => {
    const named = teams.filter((t) => t.name.trim());
    if (!named.length) {
      setMsg('Minimal satu kelompok bernama.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const nextNames = named.map((t) => t.name.trim()).join('|');
      const namesChanged = nextNames !== savedTeamNames;
      await saveStage(sessionId, namesChanged
        ? { teams: { teams: named }, resetPresentOrder: true }
        : { teams: { teams: named } });
      if (namesChanged) {
        setActivity((a) => ({ ...a, presentOrder: [], presentDrawnAt: null, presentIndex: 0, presentSlide: 0 }));
      }
      const cfg = await fetchStage(sessionId);
      const list: LabTeamRow[] = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      setTeams(list.length ? list.map((t: LabTeamRow) => ({ ...labEmptyTeam(), ...t })) : [labEmptyTeam()]);
      setSavedTeamNames((list.length ? list : [labEmptyTeam()]).map((t: LabTeamRow) => t.name.trim()).join('|'));
      setMsg(namesChanged ? 'Papan kelompok tersimpan — undi ulang urutan presentasi.' : 'Papan kelompok tersimpan — tampil di peserta & layar.');
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
      phase === 'A1' ? 'Sesi 1 berjalan — jar + input kartu (web 2 dari 6, paralel).' : `Sesi 2 berjalan — Stasiun A (${stations.a}) dan Stasiun B (${stations.b}) paralel.`,
    );
  };

  const startPresent = () => {
    const startedAt = new Date().toISOString();
    void pushActivity(
      { phase: 'PRESENT', startedAt, presentStartedAt: startedAt, durationSec: activity.presentSeconds, presentIndex: Math.min(activity.presentIndex, Math.max(0, presentationOrder.length - 1)), presentSlide: 0 },
      'Presentasi Kelompok dimulai. Slide Stasiun A.',
    );
  };

  const stepSlide = (direction: 1 | -1) => {
    const count = Math.max(1, presentationOrder.length);
    const next = stepLabPresentation(activity, count, direction);
    if (next.phase === 'DONE') {
      void pushActivity(
        { phase: 'DONE', startedAt: null, presentStartedAt: null, presentIndex: next.presentIndex, presentSlide: next.presentSlide },
        'Semua kelompok presentasi — lanjut refleksi/konklusi.',
      );
      return;
    }
    const changedGroup = next.presentIndex !== activity.presentIndex;
    const startedAt = new Date().toISOString();
    const team = teams[presentationOrder[next.presentIndex]];
    void pushActivity(
      {
        phase: 'PRESENT',
        startedAt: activity.startedAt || startedAt,
        presentStartedAt: changedGroup ? startedAt : activity.presentStartedAt,
        presentIndex: next.presentIndex,
        presentSlide: next.presentSlide,
      },
      changedGroup
        ? `Giliran ${team?.name || `kelompok ${next.presentIndex + 1}`}.`
        : `Slide ${next.presentSlide + 1}/3 · ${LAB_PRESENT_SLIDES[next.presentSlide]}.`,
    );
  };

  const nextGroup = () => {
    const count = Math.max(1, presentationOrder.length);
    const next = activity.presentIndex + 1;
    if (next >= count) {
      void pushActivity(
        { phase: 'DONE', startedAt: null, presentStartedAt: null, presentIndex: Math.max(0, count - 1), presentSlide: 0 },
        'Semua kelompok presentasi — lanjut refleksi/konklusi.',
      );
      return;
    }
    const startedAt = new Date().toISOString();
    const team = teams[presentationOrder[next]];
    void pushActivity({ phase: 'PRESENT', startedAt, presentStartedAt: startedAt, presentIndex: next, presentSlide: 0 }, `Giliran ${team?.name || `kelompok ${next + 1}`}.`);
  };

  const stopTimer = () => {
    void pushActivity({ startedAt: null, presentStartedAt: null }, 'Timer dihentikan (transisi manual).');
  };

  const startDraw = () => {
    void pushActivity(
      { phase: 'DRAW', startedAt: new Date().toISOString(), durationSec: 300, presentStartedAt: null },
      'Undian — tampilkan nomor grup di layar.',
    );
  };

  const startBriefing = () => {
    void pushActivity(
      { phase: 'IDLE', startedAt: new Date().toISOString(), durationSec: 900, presentStartedAt: null },
      'Firman & Briefing 15 menit — 10 menit judul firman, 5 menit panggil perwakilan.',
    );
  };

  const resetStage = () => {
    void pushActivity(
      { phase: 'DRAW', startedAt: null, presentStartedAt: null, cardIndex: 0, presentIndex: 0, presentSlide: 0 },
      'Timer & panggung direset.',
    );
  };

  const adminUpload = async (teamIndex: number, file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setMsg('Foto terlalu besar (maks 15MB).');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsDataURL(file);
      });
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/lab/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teamIndex,
          kind: uploadSlot[teamIndex] || 'POT',
          filename: file.name,
          mimetype: file.type,
          data,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengunggah foto.');
      const who = d?.update?.userName ? ` Tercatat atas nama ${d.update.userName}.` : '';
      setMsg(`Foto tersimpan untuk kelompok.${who}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setBusy(false);
    }
  };

  const adminDeletePhoto = async (updateId: string) => {
    if (!window.confirm('Hapus foto ini dari kelompok?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/lab/updates/${encodeURIComponent(updateId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menghapus foto.');
      setLightbox(null);
      setMsg('Foto dihapus. Slot kuota bisa diisi lagi.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menghapus foto.');
    } finally {
      setBusy(false);
    }
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
    activity.phase === 'A1' ? 'Sesi 1 · Reminder Jar'
      : activity.phase === 'A2' ? `Sesi 2 · Art Stations (${stations.a} ∥ ${stations.b})`
        : activity.phase === 'PRESENT' ? 'Presentasi Kelompok'
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
                {activity.phase === 'PRESENT' ? `${teams[currentTeamIndex]?.name || `Kelompok ${currentTeamIndex + 1}`} · ${Math.min(presentationOrder.length, activity.presentIndex + 1)} / ${Math.max(1, presentationOrder.length)} · slide ${activity.presentSlide + 1}/3 ${LAB_PRESENT_SLIDES[activity.presentSlide] || ''}` : 'Timer fase'}
              </p>
              <p className="font-mono text-3xl font-black leading-none">{fmtLabClock(remainingMs)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <button type="button" disabled={busy} onClick={startDraw} className="px-3 py-1.5 rounded-lg bg-white/10 text-[11px] font-bold disabled:opacity-60">Undian</button>
              <button type="button" disabled={busy} onClick={startBriefing} className="px-3 py-1.5 rounded-lg bg-white/10 text-[11px] font-bold disabled:opacity-60">Briefing</button>
              <button type="button" disabled={busy} onClick={() => startPhase('A1')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold disabled:opacity-60">Sesi 1</button>
              <button type="button" disabled={busy} onClick={() => startPhase('A2')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold disabled:opacity-60">Sesi 2</button>
              <button type="button" disabled={busy} onClick={startPresent} className="px-3 py-1.5 rounded-lg bg-brand text-[11px] font-bold disabled:opacity-60">Presentasi</button>
              <button type="button" disabled={busy} onClick={stopTimer} className="px-3 py-1.5 rounded-lg border border-white/30 text-[11px] font-bold disabled:opacity-60">Stop</button>
              <button type="button" disabled={busy} onClick={resetStage} className="px-3 py-1.5 rounded-lg border border-white/30 text-[11px] font-bold disabled:opacity-60">Reset</button>
            </div>
          </div>

          {activity.phase === 'PRESENT' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#8C8880]">
                Sedang tampil: {teams[currentTeamIndex]?.name || `Kelompok ${currentTeamIndex + 1}`}
                {teams[currentTeamIndex]?.repName ? ` — ${teams[currentTeamIndex].repName}` : ''}
                {' · '}slide {activity.presentSlide + 1}/3 {LAB_PRESENT_SLIDES[activity.presentSlide]}
              </span>
              <button type="button" disabled={busy} onClick={() => stepSlide(-1)} className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-60">
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <button type="button" disabled={busy} onClick={() => stepSlide(1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
                Berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button type="button" disabled={busy} onClick={nextGroup} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-60">
                Lewati kelompok
              </button>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-[#EFEDE8] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black text-[#8C8880]">Urutan presentasi</p>
              <span className="text-[10px] text-[#8C8880]">
                {activity.presentDrawnAt ? `diundi ${new Date(activity.presentDrawnAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'belum diundi'}
              </span>
              <button type="button" disabled={busy || !namedTeamCount} onClick={drawOrder} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-bold disabled:opacity-60">
                <Dices className="w-3.5 h-3.5" /> {activity.presentOrder.length ? 'Undi ulang' : 'Undi urutan'}
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {presentationOrder.map((teamIndex, pos) => (
                <div key={`${teamIndex}-${pos}`} className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${pos === activity.presentIndex && activity.phase === 'PRESENT' ? 'bg-brand/10 border border-brand/30' : 'bg-[#FAF9F5]'}`}>
                  <span className="w-5 h-5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-black grid place-items-center">{pos + 1}</span>
                  <span className="text-xs font-bold truncate">{teams[teamIndex]?.name || `Kelompok ${teamIndex + 1}`}</span>
                  {teams[teamIndex]?.repName && <span className="text-[10px] text-[#8C8880] truncate">· {teams[teamIndex].repName}</span>}
                  {postponedSet.has(teamIndex) && <span className="text-[9px] font-black uppercase text-amber-700">ditunda</span>}
                  {skippedSet.has(teamIndex) && <span className="text-[9px] font-black uppercase text-red-600">skip</span>}
                  <span className="ml-auto flex gap-0.5">
                    <button type="button" disabled={busy || pos === 0} onClick={() => moveOrder(pos, -1)} className="p-1 disabled:opacity-30" title="Naik"><ChevronLeft className="w-3.5 h-3.5 rotate-90" /></button>
                    <button type="button" disabled={busy || pos === presentationOrder.length - 1} onClick={() => moveOrder(pos, 1)} className="p-1 disabled:opacity-30" title="Turun"><ChevronRight className="w-3.5 h-3.5 rotate-90" /></button>
                    <button type="button" disabled={busy} onClick={() => postponeAtPos(pos)} className="px-1.5 py-0.5 text-[9px] font-bold rounded border border-amber-300 text-amber-800 disabled:opacity-30" title="Tunda ke belakang">Tunda</button>
                    <button type="button" disabled={busy} onClick={() => skipAtPos(pos)} className="px-1.5 py-0.5 text-[9px] font-bold rounded border border-red-200 text-red-700 disabled:opacity-30" title="Lewati presentasi">Skip</button>
                  </span>
                </div>
              ))}
              {activity.presentPostponed.filter((i) => !presentationOrder.includes(i)).map((teamIndex) => (
                <div key={`post-${teamIndex}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold truncate">{teams[teamIndex]?.name || `Kelompok ${teamIndex + 1}`}</span>
                  <span className="text-[9px] font-black uppercase text-amber-800">ditunda (luar antrian)</span>
                  <button type="button" disabled={busy} onClick={() => reenterPostponed(teamIndex)} className="ml-auto px-2 py-0.5 text-[9px] font-bold rounded bg-amber-600 text-white disabled:opacity-30">
                    Masuk lagi
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#8C8880]">Undian dilakukan di kontrol; peserta & layar mengikuti urutan ini. Tunda = ke belakang antrian; Skip = tidak presentasi.</p>
            {(activity.phase === 'DONE' || activity.phase === 'PRESENT') && (
              <button type="button" disabled={busy} onClick={() => void releaseLabReactions()} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-60">
                Rilis reaksi presentasi → word cloud
              </button>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-[#EFEDE8] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-black text-[#8C8880]">Laporan karya kelompok</p>
              <a href={`/api/worship/sessions/${encodeURIComponent(sessionId)}/lab.csv`} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D9D7D0] text-[11px] font-bold">
                Unduh CSV
              </a>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#8C8880]">
                    <th className="py-1 pr-2">Kelompok</th>
                    <th className="py-1 pr-2">Perwakilan</th>
                    <th className="py-1 pr-2">Stasiun A</th>
                    <th className="py-1 pr-2">Stasiun B</th>
                    <th className="py-1 pr-2">Foto</th>
                    <th className="py-1 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(lab?.teams || []).map((t) => (
                    <tr key={t.index} className="border-t border-[#EFEDE8]">
                      <td className="py-1.5 pr-2 font-bold">{t.name}</td>
                      <td className="py-1.5 pr-2">{t.repName || '—'}</td>
                      <td className="py-1.5 pr-2">{t.pot.progress == null ? '—' : `${t.pot.progress}%`}</td>
                      <td className="py-1.5 pr-2">{t.bag.progress == null ? '—' : `${t.bag.progress}%`}</td>
                      <td className="py-1.5 pr-2">{t.photoCount} · {t.photoComplete ? 'lengkap' : 'belum'}</td>
                      <td className="py-1.5 pr-2">
                        <span className={`px-1.5 py-0.5 rounded-full font-black ${t.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.done ? 'SELESAI' : 'PROSES'}</span>
                      </td>
                    </tr>
                  ))}
                  {!lab?.teams?.length && <tr><td colSpan={6} className="py-2 text-[#8C8880]">Belum ada kelompok/laporan.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2">
              {(lab?.teams || []).map((t) => {
                const shots = [
                  ...t.pot.photos.map((p) => ({ ...p, label: `Stasiun A · ${stations.a} · ${t.name}` })),
                  ...t.bag.photos.map((p) => ({ ...p, label: `Stasiun B · ${stations.b} · ${t.name}` })),
                  ...(t.groupPhoto ? [{ ...t.groupPhoto, label: `Bersama · ${t.name}` }] : []),
                ];
                return (
                  <div key={t.index} className="rounded-lg border border-[#EFEDE8] p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-black">{t.name || `Kelompok ${t.index + 1}`}</p>
                      <select
                        className="rounded-lg border border-[#D9D7D0] bg-white px-2 py-1 text-[10px] font-bold"
                        value={uploadSlot[t.index] || 'POT'}
                        onChange={(e) => setUploadSlot((s) => ({ ...s, [t.index]: e.target.value as 'POT' | 'BAG' | 'GROUP' }))}
                      >
                        <option value="POT">Stasiun A · {stations.a} (maks {LAB_PHOTO_CAP.POT})</option>
                        <option value="BAG">Stasiun B · {stations.b} (maks {LAB_PHOTO_CAP.BAG})</option>
                        <option value="GROUP">Foto Bersama (maks {LAB_PHOTO_CAP.GROUP})</option>
                      </select>
                      <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[10px] font-bold cursor-pointer">
                        <ImagePlus className="w-3 h-3" /> Upload atas nama kelompok
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            void adminUpload(t.index, file);
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {shots.map((p) => (
                        <div key={p.id} className="relative">
                          <button
                            type="button"
                            onClick={() => setLightbox({ src: p.photoUrl || p.thumbUrl || '', label: p.label })}
                            className="block w-full"
                            title={p.userName ? `${p.label} · ${p.userName}` : p.label}
                          >
                            <img src={p.thumbUrl || p.photoUrl || ''} alt={p.label} className="h-16 w-full object-cover rounded-lg border border-[#EFEDE8]" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void adminDeletePhoto(p.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white grid place-items-center"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {!shots.length && <p className="text-[10px] text-[#8C8880] col-span-3">Belum ada foto.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {lightbox && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                <div className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setLightbox(null)} className="absolute -top-2 right-0 w-8 h-8 rounded-full bg-white text-[#1B1B1B] grid place-items-center" title="Tutup">
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-white text-xs font-bold mb-2">{lightbox.label}</p>
                  <img src={lightbox.src} alt={lightbox.label} className="max-h-[85vh] max-w-full object-contain" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="text-[10px] font-bold text-[#8C8880]">
              Sesi 1 (menit)
              <input
                type="number" min={1} max={120}
                value={Math.round(activity.durations.A1 / 60)}
                onChange={(e) => setActivity((a) => ({ ...a, durations: { ...a.durations, A1: Math.max(60, Math.min(7200, (Number(e.target.value) || 15) * 60)) } }))}
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="text-[10px] font-bold text-[#8C8880]">
              Sesi 2 (menit)
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
                onChange={(e) => setActivity((a) => ({ ...a, presentSeconds: Math.max(30, Math.min(600, Number(e.target.value) || 150)), durations: { ...a.durations, PRESENT: Math.max(30, Math.min(600, Number(e.target.value) || 150)) } }))}
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black text-[#8C8880]">Papan kelompok ({teams.filter((t) => t.name.trim() && !t.missing).length}/{LAB_TEAM_CAP})</p>
              <button type="button" disabled={busy} onClick={() => void loadTenGroups()} className="text-[10px] font-bold text-brand underline disabled:opacity-60">Muat 10 kelompok</button>
            </div>
            <p className="mt-1 text-[10px] text-[#8C8880]">Nama dan anggota datang dari 10 kelompok Beyonders. Sesi yang sudah terisi tidak berubah sampai tombol ini ditekan. Perwakilan, Stasiun A ({stations.a}), dan Stasiun B ({stations.b}) dipilih dari anggota kelompok itu.</p>
            <div className="mt-2 space-y-2">
              {teams.map((t, i) => {
                const options = membersOf(t);
                const rolePick = (key: 'pot' | 'bag', label: string) => (
                  <div className="rounded-lg border border-[#EFEDE8] p-2">
                    <p className="text-[10px] font-bold text-[#8C8880]">{label} ({(t[key] || []).length}/{LAB_STATION_CAP})</p>
                    <div className="mt-1 max-h-28 overflow-auto space-y-0.5">
                      {options.map((p) => (
                        <label key={`${key}-${p.id}`} className="flex items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={(t[key] || []).includes(p.name)}
                            onChange={() => toggleRole(i, key, p.name)}
                            className="w-3.5 h-3.5"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      ))}
                      {!options.length && <p className="text-[10px] text-[#8C8880]">Muat kelompok untuk memilih anggota.</p>}
                    </div>
                  </div>
                );
                return (
                  <div key={t.groupId || i} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={t.name}
                        onChange={(e) => setTeam(i, { name: e.target.value })}
                        readOnly={Boolean(t.groupId)}
                        placeholder={`Nama kelompok ${i + 1}`}
                        className={INPUT}
                      />
                      {!t.groupId && (
                        <button type="button" onClick={() => setTeams((p) => p.filter((_, j) => j !== i))} className="shrink-0 px-2 text-red-500" title="Hapus kelompok">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {t.missing && <p className="text-[10px] font-bold text-amber-800">Belum ada di database — baris peringatan, tidak ikut undian presentasi.</p>}
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input value={t.station} onChange={(e) => setTeam(i, { station: e.target.value })} placeholder="Meja / stasiun" className={INPUT} />
                      <select value={t.repUserId || ''} onChange={(e) => selectRep(i, e.target.value)} className={INPUT}>
                        <option value="">Perwakilan kelompok…</option>
                        {options.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        {t.repUserId && !options.some((p) => p.id === t.repUserId) && (
                          <option value={t.repUserId}>{t.repName || t.repUserId}</option>
                        )}
                      </select>
                    </div>
                    <p className="text-[11px] text-[#8C8880]">
                      {t.members.length ? t.members.join(', ') : 'Belum ada roster. Tekan Muat 10 kelompok.'}
                      {t.memberUserIds.length > t.members.length ? ` · ${t.memberUserIds.length} akun bisa melihat feed` : ''}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {rolePick('pot', `Stasiun A · ${stations.a}`)}
                      {rolePick('bag', `Stasiun B · ${stations.b}`)}
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C8880]">
                      <input type="checkbox" checked={t.done} onChange={(e) => setTeam(i, { done: e.target.checked })} className="w-4 h-4" />
                      Selesai (override Admin)
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {teams.length < LAB_TEAM_CAP && (
                <button type="button" onClick={() => setTeams((p) => [...p, labEmptyTeam()])} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Kelompok
                </button>
              )}
              <button type="button" disabled={busy || !participantsReady} onClick={() => void saveTeams()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60">
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
