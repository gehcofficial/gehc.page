import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clapperboard, Download, Flag, Loader2, Lock, Send, Sparkles, Swords, Users } from 'lucide-react';
import {
  COMMITMENT_KEY,
  MONOLOG_QUESTION_KEYS,
  PATTERN_SEGMENTS,
  canOpenSegmentPattern,
  filmLikertMeans,
  filmLikertPairs,
  isQuestionOpen,
  noteSlotsFor,
  resolvePinnedSegment,
  segmentForPattern,
  widgetsFor,
  type SegmentWidget,
} from '../../lib/session-engine';
import {
  SCALE_LABELS,
  STATUS_LABELS,
  type MentoringSessionPayload,
} from '../../lib/mentoring';
import { buildSessionRecapPdf, downloadBlob } from '../../lib/mentoringPdf';
import SessionTimer from './SessionTimer';
import { SessionNotes } from './SessionNotes';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';

const ROUND_PHASE_LABEL: Record<string, string> = {
  brief: 'Briefing mosi',
  pro: 'Pemaparan PRO',
  kontra: 'Pemaparan KONTRA',
  sanggah: 'Sanggahan',
  blow: 'Final Blow',
  jeda: 'Jeda & transisi',
  selesai: 'Ronde selesai',
};

function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Label timer langkah film (timer sesi penuh tidak dipakai; bagian film tanpa timer). */
const FILM_STEP_LABELS: Record<string, string> = {
  M0: 'Likert Awal',
  M3: 'Likert Akhir & Lesson Learned',
  M4: 'Undi & Kesaksian',
};

type LikertPayload = NonNullable<MentoringSessionPayload['likert']>;

/**
 * Widget Likert film 2 ronde (AWAL baseline → AKHIR delta).
 * Ronde ditentukan segmen aktif; gate ikut `likert.rounds` dari kontrol.
 */
const FilmLikertCard: React.FC<{
  slug: string;
  likert: LikertPayload;
  round: 'PRE' | 'POST';
  editable: boolean;
  showDelta: boolean;
  affirm?: { low: string; high: string } | null;
  onDone: () => void;
}> = ({ slug, likert, round, editable, showDelta, affirm, onDone }) => {
  const pairs = useMemo(() => filmLikertPairs(likert.items || [], likert.myValues || {}), [likert]);
  const means = useMemo(() => filmLikertMeans(pairs, likert.means || {}), [pairs, likert]);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const init: Record<string, number> = {};
    for (const p of pairs) {
      const id = round === 'PRE' ? p.preId : p.postId;
      const v = id ? likert.myValues?.[id] : null;
      if (id && v != null) init[id] = Number(v);
    }
    setVals(init);
  }, [pairs, likert, round]);
  const gate = String(likert.rounds?.[round.toLowerCase() as 'pre' | 'post'] ?? (round === 'PRE' ? 'open' : 'closed')).toLowerCase();
  const canAnswer = editable && likert.open && gate !== 'closed';
  const ids = pairs.map((p) => (round === 'PRE' ? p.preId : p.postId)).filter(Boolean) as string[];
  const answeredCount = ids.filter((id) => vals[id] != null).length;
  const submit = useCallback(async () => {
    if (answeredCount < ids.length) {
      setNote('Isi semua 5 pernyataan dulu (skala 1–5).');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const answers: Record<string, number> = {};
      for (const id of ids) answers[id] = vals[id];
      const r = await fetch('/api/worship/likert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, answers, round }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengirim.');
      setNote(typeof (d as { affirmation?: unknown }).affirmation === 'string' && (d as { affirmation: string }).affirmation
        ? (d as { affirmation: string }).affirmation
        : 'Tersimpan — terima kasih atas kejujuranmu.');
      onDone();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal mengirim.');
    } finally {
      setBusy(false);
    }
  }, [answeredCount, ids, onDone, slug, vals, round]);
  const allAnswered = answeredCount >= ids.length && ids.length > 0;
  const roundAvg = allAnswered
    ? ids.reduce((n, id) => n + (vals[id] || 0), 0) / ids.length
    : null;
  const affirmText = allAnswered && affirm ? (Number(roundAvg) <= 3 ? affirm.low : affirm.high) : null;
  return (
    <div className={CARD}>
      <h4 className="text-sm font-black text-[#1B1B1B]">
        Likert {round === 'PRE' ? 'AWAL' : 'AKHIR'}
        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">baseline</span>
      </h4>
      <p className="text-[11px] text-[#8C8880] mt-1">
        {round === 'PRE'
          ? 'Potret jujur sebelum nonton — tidak ada jawaban salah.'
          : 'Lima pernyataan yang SAMA — jawab lagi dengan jujur setelah film.'}
      </p>
      {!canAnswer && (
        <p className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {gate === 'closed'
            ? round === 'PRE'
              ? 'Ronde AWAL sudah dikunci — lanjut ke tahap Nonton & Catat.'
              : 'Likert AKHIR dibuka setelah sesi film selesai.'
            : likert.open
              ? 'Ronde ini belum dibuka operator.'
              : 'Akses Likert belum dibuka.'}
        </p>
      )}
      <div className="mt-3 space-y-3">
        {pairs.map((p) => {
          const id = (round === 'PRE' ? p.preId : p.postId) || '';
          return (
            <div key={p.n} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3">
              <p className="text-xs font-bold text-[#1B1B1B]">{p.n}. {p.text}</p>
              <div className="mt-2 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    title={SCALE_LABELS[v - 1]}
                    disabled={!canAnswer || busy}
                    onClick={() => setVals((prev) => ({ ...prev, [id]: v }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-black border disabled:opacity-60 ${vals[id] === v ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!canAnswer || busy || answeredCount < ids.length}
        onClick={() => void submit()}
        className="mt-3 w-full py-2.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
      >
        {busy ? 'Mengirim…' : `Kirim Likert ${round === 'PRE' ? 'AWAL' : 'AKHIR'} (${answeredCount}/${ids.length})`}
      </button>
      {note && <p className="mt-2 text-[11px] text-[#8C8880]">{note}</p>}
      {affirmText && (
        <div className="mt-3 rounded-xl border border-brand/30 bg-gradient-to-r from-brand/10 to-brand-end/10 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-brand mb-0.5">Afirmasi firman untukmu</p>
          <p className="text-xs leading-relaxed text-[#1B1B1B]">{affirmText}</p>
        </div>
      )}
      {showDelta && (
        <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Perubahan (awal → akhir)</p>
          <div className="mt-2 space-y-1.5">
            {pairs.map((p, i) => {
              const m = means[i];
              return (
                <div key={p.n} className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-[#1B1B1B] w-6">P{p.n}</span>
                  <span className="flex-1 text-[#8C8880] truncate">{p.text}</span>
                  <span className="tabular-nums font-bold">
                    {p.pre ?? '–'} → {p.post ?? '–'}
                  </span>
                  {p.delta != null && (
                    <span className={`px-1.5 py-0.5 rounded-full font-black ${p.delta > 0 ? 'bg-emerald-50 text-emerald-700' : p.delta < 0 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                      {p.delta > 0 ? `+${p.delta}` : p.delta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-[#8C8880]">
            Rata-rata kelompok: {means.length ? '' : 'belum ada data'}
            {means.map((m, i) => (
              <span key={i} className="tabular-nums">
                {i > 0 ? ' · ' : ''}P{m.n} {m.preAvg ?? '–'}→{m.postAvg ?? '–'} ({m.preN}/{m.postN})
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Alur peserta generik semua pola non-post-to-post: segmen + widget
 * (guide/rounds/screening/teams/testimony/notes/download) dari registry
 * session-engine + PDF rekap generik.
 */
export const PatternDay: React.FC<{ slug: string; code: string }> = ({ slug, code }) => {
  const c = String(code || 'MONOLOG').toUpperCase();
  const [data, setData] = useState<MentoringSessionPayload | null>(null);
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error' | 'auth'; message?: string }>({
    status: 'loading',
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Afirmasi firman yang baru diterima dari server (tampil instan setelah simpan). */
  const [noteAffirm, setNoteAffirm] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [chipDone, setChipDone] = useState(false);
  const [chipBusy, setChipBusy] = useState(false);
  const [chipNote, setChipNote] = useState<string | null>(null);
  /** Pin mundur ke tahap yang sudah terbuka (ala post-to-post); null = ikut alur server. */
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => { setPinned(null); }, [slug]);

  const load = useCallback(async () => {
    if (!slug) {
      setState({ status: 'error', message: 'Slug sesi tidak ada di tautan.' });
      return;
    }
    try {
      const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (r.status === 401) {
        window.location.hash = `#/login?next=${encodeURIComponent(`#/mentoring/${slug}`)}`;
        setState({ status: 'auth' });
        return;
      }
      const d: MentoringSessionPayload = await r.json();
      if (!r.ok) {
        setState({ status: 'error', message: (d as unknown as { error?: string })?.error || 'Gagal memuat.' });
        return;
      }
      setData(d);
      setState({ status: 'ok' });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memuat.' });
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const status = data?.session.status || 'DRAFT';
  const notes = data?.notes || {};
  const phaseName = String(data?.phase?.name || '').toUpperCase() || null;
  const live = useMemo(() => ({ phaseName }), [phaseName]);
  const phaseTick = useNowTick(Boolean(data?.phase?.startedAt));
  const phaseRemainMs = data?.phase?.startedAt
    ? new Date(data.phase.startedAt).getTime() + Number(data.phase.durationSec) * 1000 - phaseTick
    : null;
  const phaseExpired = phaseRemainMs !== null && phaseRemainMs <= 0;
  const slots = useMemo(() => {
    const base = noteSlotsFor(c);
    if (c === 'MONOLOG') {
      const guide = (data?.guide || []).filter(Boolean);
      const deep = (data?.deepGuide || []).filter(Boolean);
      const byKey = new Map(base.map((s) => [s.key, s]));
      const qs = MONOLOG_QUESTION_KEYS.map((key, i) => {
        const text = i < 3 ? guide[i] : deep[i - 3];
        const fallback = byKey.get(key);
        return {
          key,
          label: text ? `Q${i + 1} — ${text}` : (fallback?.label || `Q${i + 1}`),
          placeholder: fallback?.placeholder || '',
        };
      });
      const rest = base.filter((s) => !MONOLOG_QUESTION_KEYS.includes(s.key));
      return [...qs, ...rest];
    }
    // BEDAH_FILM: label slot catatan = teks Q draf (film-q1..3 via deepGuide),
    // bukan label hardcode generik — agar pertanyaan draf tampil di peserta.
    if (c === 'BEDAH_FILM') {
      const qs = (data?.deepGuide || []).filter(Boolean);
      if (qs.length) {
        return base.map((s) => {
          const m = /^FILM-Q([1-3])$/.exec(s.key);
          const text = m ? qs[Number(m[1]) - 1] : '';
          return text ? { ...s, label: text } : s;
        });
      }
    }
    return base;
  }, [c, data?.guide, data?.deepGuide]);
  const noteKeys = useMemo(() => slots.map((s) => s.key).filter((k) => k !== COMMITMENT_KEY), [slots]);
  const filled = noteKeys.some((k) => String(notes[k] || '').trim());
  // Progres film untuk stepper (pre/post likert, chip, gate AKHIR).
  const filmPairs = useMemo(
    () => (c === 'BEDAH_FILM' ? filmLikertPairs(data?.likert.items || [], data?.likert.myValues || {}) : []),
    [c, data],
  );
  const filmExtra = useMemo(() => {
    if (c !== 'BEDAH_FILM') return undefined;
    return {
      preAnswered: filmPairs.length > 0 && filmPairs.every((p) => p.pre != null),
      postAnswered: filmPairs.length > 0 && filmPairs.every((p) => p.post != null),
      chipDone,
      // Langsung dari data (tanpa `has`, agar tak sirkular dengan `segment`).
      screeningOn: Boolean(data?.screening?.startedAt),
      // Gate AKHIR dari kontrol (M3) — peserta maju mengikuti gate, bukan countdown.
      postOpen: String(data?.likert.rounds?.post || 'closed').toLowerCase() === 'open',
      // Gate AWAL sudah dikunci (M1) → peserta telat lanjut nonton, tak terkunci.
      preOpen: String(data?.likert.rounds?.pre || 'open').toLowerCase() !== 'closed',
    };
  }, [c, filmPairs, chipDone, data]);
  const segmentOrder = useMemo(() => (PATTERN_SEGMENTS[c] || []).map((s) => s.id), [c]);
  const derivedSegment = segmentForPattern(c, status, filled, live, filmExtra);
  const segment = resolvePinnedSegment(segmentOrder, pinned, derivedSegment);
  // F1 (Bedah Lagu): HP hanya menampilkan Q1-Q3.
  const visibleSlots = useMemo(() => {
    if (c === 'MONOLOG' && segment === 'lagu') {
      const first3 = new Set(MONOLOG_QUESTION_KEYS.slice(0, 3));
      return slots.filter((s) => first3.has(s.key));
    }
    return slots;
  }, [c, segment, slots]);
  const steps = PATTERN_SEGMENTS[c] || [];
  const widgets = widgetsFor(c, segment);
  const has = (w: SegmentWidget) => widgets.includes(w);

  useEffect(() => {
    const mine = data?.chips?.mine || [];
    setPicked((prev) => (prev.length ? prev : mine));
    if (mine.length) setChipDone(true);
  }, [data?.chips?.mine]);

  const saveNote = useCallback(
    async (key: string, value: string) => {
      setSaveError(null);
      const r = await fetch('/api/worship/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, notes: [{ topicCode: key, content: value }] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSaveError(d?.error || 'Gagal menyimpan catatan.');
        throw new Error(d?.error || 'Gagal menyimpan.');
      }
      // Segarkan catatan + tampilkan afirmasi firman langsung tanpa tunggu polling.
      if (d.notes && typeof d.notes === 'object') {
        setData((prev) => (prev ? { ...prev, notes: d.notes } : prev));
      }
      if (d.affirmations && typeof d.affirmations === 'object') {
        setNoteAffirm((prev) => ({ ...prev, ...(d.affirmations as Record<string, string>) }));
      }
    },
    [slug],
  );

  // Hook chip Lesson Learned — wajib di atas semua early return (aturan hooks).
  const chipLimit = data?.session.chipLimit || 3;
  const toggleChip = useCallback(
    (code: string) => {
      setPicked((prev) => {
        if (prev.includes(code)) return prev.filter((x) => x !== code);
        if (prev.length >= chipLimit) return prev;
        return [...prev, code];
      });
    },
    [chipLimit],
  );

  const submitChips = useCallback(async () => {
    setChipBusy(true);
    setChipNote(null);
    try {
      const r = await fetch('/api/worship/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, codes: picked }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengirim chip.');
      setChipDone(true);
      await load();
    } catch (e) {
      setChipNote(e instanceof Error ? e.message : 'Gagal mengirim chip.');
    } finally {
      setChipBusy(false);
    }
  }, [slug, picked, load]);

  const screening = data?.screening || null;

  const rounds = data?.rounds || null;
  const currentRound = rounds?.rounds?.[rounds?.current || 0] || null;
  const teams = data?.teams?.teams || [];
  const testimony = data?.testimony || [];
  const song = data?.song || null;
  const fgdQ = Number(data?.fgd?.currentQ || 0);
  // MONOLOG: hanya Q yang sudah dibuka pemicu yang bisa dijawab.
  const lockedKeys = useMemo(() => {
    if (c !== 'MONOLOG') return [] as string[];
    return MONOLOG_QUESTION_KEYS.filter((_, i) => !isQuestionOpen(i + 1, fgdQ));
  }, [c, fgdQ]);

  const download = useCallback(() => {
    if (!data) return;
    const slotLabel = (key: string) => slots.find((s) => s.key === key)?.label || key;
    const mineChips = data.chips?.mine || [];
    const chipLabels = (data.chips?.list || [])
      .filter((chip) => picked.includes(chip.code) || mineChips.includes(chip.code))
      .map((chip) => ({ code: chip.code, label: chip.label }));
    const { blob, filename } = buildSessionRecapPdf({
      kicker: `GEHC YOUTH — ${data.session.pattern?.name || c}`.toUpperCase(),
      title: data.session.title,
      meta: [
        data.session.sessionDate ? new Date(data.session.sessionDate).toLocaleDateString('id-ID') : null,
        data.session.pattern?.name || null,
      ]
        .filter(Boolean)
        .join(' · '),
      participantName: data.me?.name || 'Peserta',
      sections: [
        {
          heading: 'Panduan',
          lines: [...(data.guide || []).filter(Boolean), ...(c === 'MONOLOG' || c === 'BEDAH_FILM' ? (data.deepGuide || []).filter(Boolean) : [])].map((g, i) => ({ label: `Q${i + 1}`, body: g })),
        },
        ...(song?.title
          ? [{
              heading: 'Lagu Bedah',
              lines: [
                { label: 'Judul', body: `${song.title}${song.bookRef ? ` (${song.bookRef})` : ''}${song.writer || song.singer ? ` — ${song.writer || song.singer}` : ''}` },
                ...(song.story ? [{ label: 'Kisah', body: song.story }] : []),
                ...(song.about ? [{ label: 'Makna', body: song.about }] : []),
              ],
            }]
          : []),
        ...(currentRound
          ? [{
              heading: 'Ronde debat',
              lines: [
                { label: 'Mosi', body: currentRound.mosi },
                { body: `PRO (${currentRound.pro || '-'}) ${currentRound.proScore} : ${currentRound.kontraScore} KONTRA (${currentRound.kontra || '-'})` },
              ],
            }]
          : []),
        ...(screening ? [{ heading: 'Film', lines: [{ body: screening.title }] }] : []),
        ...(teams.length
          ? [{ heading: 'Tim misi', lines: teams.map((t) => ({ label: t.name, body: `${t.task || ''}${t.done ? ' ✓' : ''}` })) }]
          : []),
        ...(testimony.length
          ? [{ heading: 'Kesaksian', lines: testimony.map((p) => ({ label: `Slot ${p.slot}`, body: `${p.name} (${p.role})` })) }]
          : []),
        {
          heading: 'Catatan',
          lines: noteKeys.map((k) => ({ label: slotLabel(k), body: String(notes[k] || '') })),
        },
        ...(c === 'BEDAH_FILM' && filmPairs.length
          ? [{
              heading: 'Likert Film (awal → akhir)',
              lines: filmPairs.map((p) => ({
                label: `P${p.n}`,
                body: `${p.pre ?? '–'} → ${p.post ?? '–'}${p.delta != null ? ` (Δ${p.delta > 0 ? '+' : ''}${p.delta})` : ''} · ${p.text}`,
              })),
            }]
          : []),
        { heading: 'Komitmen', lines: [{ body: String(notes[COMMITMENT_KEY] || '') }] },
      ],
      chips: chipLabels,
    });
    downloadBlob(filename, blob);
  }, [data, notes, slots, noteKeys, currentRound, screening, teams, testimony, c, picked, filmPairs]);

  if (state.status === 'loading') {
    return (
      <div className="py-16 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat sesi…
      </div>
    );
  }
  if (state.status !== 'ok' || !data) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white p-6 text-center max-w-2xl">
        <p className="text-sm font-bold text-[#1B1B1B]">Sesi tidak dapat dimuat</p>
        <p className="text-xs text-[#8C8880] mt-1">{state.message}</p>
      </div>
    );
  }

  const open = (id: string) => canOpenSegmentPattern(c, id, status, filled, live, filmExtra);
  const editable = status !== 'DRAFT' && status !== 'CLOSED';

  return (
    <div className="space-y-3 max-w-2xl">
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-brand">
              {data.session.pattern?.name || c}
            </p>
            <h2 className="text-lg font-black tracking-tight truncate">{data.session.title}</h2>
          </div>
          <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] font-bold text-[#8C8880]">
            {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
          </span>
        </div>
        <div className="mt-3">
          {c === 'MONOLOG' ? (
            phaseRemainMs !== null && (phaseName === 'F2' || phaseName === 'F3' || phaseName === 'CLOSING') ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#1B1B1B] text-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  {phaseName === 'F2' ? 'Diskusi kelompok' : phaseName === 'F3' ? 'Kesaksian' : 'Penutup'}
                  {phaseExpired ? ' · waktu habis' : ''}
                </p>
                <p className="font-display text-2xl font-black tabular-nums">
                  {phaseExpired ? '00:00' : fmtRemain(phaseRemainMs)}
                </p>
              </div>
            ) : null
          ) : c === 'BEDAH_FILM' ? (
            phaseRemainMs !== null && phaseName && FILM_STEP_LABELS[phaseName] ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#1B1B1B] text-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  {FILM_STEP_LABELS[phaseName]}{phaseExpired ? ' · waktu habis' : ''}
                </p>
                <p className="font-display text-2xl font-black tabular-nums">
                  {phaseExpired ? '00:00' : fmtRemain(phaseRemainMs)}
                </p>
              </div>
            ) : null
          ) : (
            <SessionTimer timer={data.timer} />
          )}
        </div>
        {steps.length > 0 && (
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Tahap ibadah">
            {steps.map((s) => {
              const unlocked = canOpenSegmentPattern(c, s.id, status, filled, live, filmExtra);
              const isActive = s.id === segment;
              const isPast = segmentOrder.indexOf(s.id) < segmentOrder.indexOf(segment);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!unlocked}
                  title={s.hint}
                  onClick={() => { setPinned(s.id); window.scrollTo({ top: 0 }); }}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black border transition-all disabled:opacity-60 ${
                    isActive
                      ? 'bg-[#1B1B1B] text-white border-transparent'
                      : isPast
                        ? 'bg-brand/10 text-brand border-brand/20'
                        : 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]'
                  }`}
                >
                  {isPast && !isActive
                    ? <Check className="w-3 h-3" />
                    : !unlocked
                      ? <Lock className="w-3 h-3" />
                      : null}
                  {s.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {segment === 'penutup' && (
        <div className={`${CARD} border-brand/40 bg-gradient-to-r from-brand/10 to-brand-end/10`}>
          <p className="text-sm font-black text-[#1B1B1B]">
            Terima kasih, {data.me?.name || 'Peserta'} — yang kamu catat hari ini berarti.
          </p>
          <p className="text-[11px] text-[#8C8880] mt-1">Unduh rekap pribadimu di bawah dan bawa komitmenmu keluar pintu ini.</p>
        </div>
      )}

      {has('welcome') && (
        <div className={`${CARD} border-brand/40 bg-gradient-to-r from-brand/10 to-brand-end/10`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">Selamat datang</p>
          <p className="text-lg font-black tracking-tight mt-1">Shalom, {data.me?.name || 'Peserta'}!</p>
          <p className="text-xs leading-relaxed mt-1.5">
            Selamat datang di {data.session.title}. Hari ini tentang Rescue Plan — Tuhan punya
            rencana penyelamatan untukmu, dan kamu tidak berjalan sendirian.
          </p>
          <p className="text-[11px] text-[#8C8880] mt-1.5">
            {editable
              ? 'Akses sudah dibuka — lanjut ke tab di atas untuk mengikuti alurnya.'
              : 'Siapkan hatimu; akses diskusi dibuka sesaat lagi oleh tim.'}
          </p>
        </div>
      )}

      {has('rounds') && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2 inline-flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-brand" /> Ronde {rounds?.rounds?.length ? `${(rounds?.current || 0) + 1}/${rounds.rounds.length}` : ''}
          </h4>
          {currentRound ? (
            <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3 space-y-1.5">
              <p className="text-xs font-black">{currentRound.mosi}</p>
              <p className="text-[11px] text-[#8C8880]">
                PRO: {currentRound.pro || '-'} · KONTRA: {currentRound.kontra || '-'}
              </p>
              <p className="text-[11px] font-bold">
                Fase: {ROUND_PHASE_LABEL[rounds?.phase || ''] || rounds?.phase} · Skor {currentRound.proScore} : {currentRound.kontraScore}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#8C8880] italic">Mosi menyusul dari moderator.</p>
          )}
        </div>
      )}

      {has('screening') && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2 inline-flex items-center gap-1.5">
            <Clapperboard className="w-4 h-4 text-brand" /> Pemutaran
          </h4>
          {screening?.startedAt ? (
            <div className="rounded-xl bg-[#111] text-white p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold truncate">{screening.title}</p>
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 shrink-0">● Tayang</p>
              </div>
              <p className="text-[11px] text-white/60">Harap tenang, fokus mendengar — HP tetap boleh untuk menjawab 3 catatan di bawah.</p>
            </div>
          ) : screening ? (
            <div className="rounded-xl bg-[#111] text-white p-4">
              <p className="text-xs font-bold truncate">{screening.title}</p>
              <p className="text-[11px] text-white/60 mt-1">Film segera mulai — siapkan hati dan 3 catatanmu.</p>
            </div>
          ) : (
            <p className="text-xs text-[#8C8880] italic">Film menyusul — siapkan hati, HP tetap boleh dipegang untuk menjawab.</p>
          )}
        </div>
      )}

      {has('likert') && data?.likert && (
        <FilmLikertCard
          slug={slug}
          likert={data.likert}
          round={segment === 'likert-akhir' ? 'POST' : 'PRE'}
          editable={editable}
          showDelta={segment === 'likert-akhir' || (filmExtra?.postAnswered ?? false)}
          affirm={data.affirmations ? { low: data.affirmations.likertLow, high: data.affirmations.likertHigh } : null}
          onDone={() => void load()}
        />
      )}

      {has('teams') && teams.length > 0 && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2 inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-brand" /> Tim misi
          </h4>
          <div className="space-y-1.5">
            {teams.map((t, i) => (
              <div key={i} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
                <p className="text-xs font-black">
                  {t.name} {t.done && <span className="text-emerald-600">✓</span>}
                </p>
                {t.task && <p className="text-[11px] text-[#8C8880]">{t.task}</p>}
                {t.members.length > 0 && <p className="text-[11px] mt-0.5">{t.members.join(' · ')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {has('testimony') && testimony.length > 0 && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2">Terpilih bersaksi</h4>
          <ol className="space-y-1.5">
            {testimony.map((p) => (
              <li key={`${p.slot}-${p.userId}`} className="flex items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
                <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] font-black grid place-items-center shrink-0">
                  {p.slot}
                </span>
                <span className="text-xs font-bold flex-1 truncate">{p.name}</span>
                <span className="text-[10px] text-[#8C8880]">{[p.groupName, p.role].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {has('chips') && (
        <div className={CARD}>
          {chipDone ? (
            <div className="text-center py-4 space-y-2">
              <Sparkles className="w-7 h-7 text-brand mx-auto" />
              <p className="font-display text-xl font-black">Thank you, {data.me?.name || 'Peserta'}!</p>
              <p className="text-xs text-[#8C8880]">Lesson learned-mu tercatat. Lihat layar utama di depan.</p>
            </div>
          ) : (data.chips?.list || []).length === 0 ? (
            <p className="text-xs text-[#8C8880] italic">Pilihan lesson learned menyusul dari tim — siapkan hatimu.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-black text-[#1B1B1B]">Lesson Learned</h4>
                <p className="text-[11px] text-[#8C8880] mt-0.5">
                  Pilih maksimal {chipLimit} kata yang paling mewakili aha-moment kamu hari ini.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.chips?.list || []).map((chip) => {
                  const active = picked.includes(chip.code);
                  return (
                    <button
                      key={chip.code}
                      type="button"
                      disabled={!data.chips?.open}
                      onClick={() => toggleChip(chip.code)}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all disabled:opacity-60 ${
                        active
                          ? 'bg-gradient-to-r from-brand to-brand-end text-white border-transparent'
                          : 'bg-white text-[#8C8880] border-[#D9D7D0]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={chipBusy || !picked.length || !data.chips?.open}
                onClick={() => void submitChips()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#1B1B1B] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60"
              >
                {chipBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Kirim ({picked.length}/{chipLimit})
              </button>
              {chipNote && <p className="text-[11px] text-red-600">{chipNote}</p>}
            </div>
          )}
        </div>
      )}

      {has('song') && song?.title && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-1">🎵 Lagu Bedah: {song.title}{song.bookRef ? <span className="ml-1.5 text-[10px] font-bold text-white bg-[#1B1B1B] rounded-full px-2 py-0.5 align-middle">{song.bookRef}</span> : null}</h4>
          {(song.writer || song.singer) && <p className="text-[11px] text-[#8C8880]">Pencipta: {song.writer || song.singer}</p>}
          {song.story && (
            <div className="mt-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-0.5">Kisah di balik lagu</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{song.story}</p>
            </div>
          )}
          {song.about && <p className="text-xs leading-relaxed mt-1.5 whitespace-pre-wrap">{song.about}</p>}
          {song.story && /perlu verifikasi tim/i.test(song.story) && (
            <p className="mt-1 text-[10px] font-bold text-amber-700">⚠️ Kisah ini usulan AI — mohon verifikasi tim sebelum dibawakan.</p>
          )}
        </div>
      )}

      {has('notes') && (
        <>
          {c === 'MONOLOG' && (
            <p className="text-[11px] text-[#8C8880]">
              {fgdQ > 0
                ? `Q1–Q${Math.min(fgdQ, 5)} sudah dibuka.`
                : 'Menunggu pemicu membuka pertanyaan…'}
              {phaseRemainMs !== null && (phaseName === 'F2' || phaseName === 'F3' || phaseName === 'CLOSING') && (
                <span className="ml-2 font-black tabular-nums text-[#1B1B1B]">
                  {phaseExpired ? 'Waktu habis' : fmtRemain(phaseRemainMs)}
                </span>
              )}
            </p>
          )}
          <SessionNotes slots={visibleSlots} values={notes} onSave={saveNote} disabled={!editable} lockedKeys={lockedKeys} />
          {c === 'BEDAH_FILM' && data?.affirmations && (
            <div className="space-y-2">
              {visibleSlots
                .filter((s) => String(notes[s.key] || noteAffirm[s.key] || '').trim() && data.affirmations?.notes[s.key])
                .map((s) => (
                  <div key={s.key} className="rounded-xl border border-brand/30 bg-gradient-to-r from-brand/10 to-brand-end/10 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand mb-0.5">Afirmasi firman untukmu</p>
                    <p className="text-xs leading-relaxed text-[#1B1B1B]">{data.affirmations?.notes[s.key]}</p>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}

      {has('download') && open(segment) && (
        <div className={CARD}>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" /> Unduh rekap PDF
          </button>
          <p className="text-[11px] text-[#8C8880] mt-1.5 inline-flex items-center gap-1 ml-2">
            <Flag className="w-3 h-3" /> Berisi catatan, lesson, dan komitmenmu.
          </p>
        </div>
      )}
    </div>
  );
};
