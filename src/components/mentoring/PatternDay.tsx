import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clapperboard, Download, Flag, Loader2, Send, Sparkles, Swords, Users } from 'lucide-react';
import {
  COMMITMENT_KEY,
  MONOLOG_QUESTION_KEYS,
  PATTERN_SEGMENTS,
  canOpenSegmentPattern,
  isQuestionOpen,
  noteSlotsFor,
  segmentForPattern,
  widgetsFor,
  type SegmentWidget,
} from '../../lib/session-engine';
import {
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
  const [picked, setPicked] = useState<string[]>([]);
  const [chipDone, setChipDone] = useState(false);
  const [chipBusy, setChipBusy] = useState(false);
  const [chipNote, setChipNote] = useState<string | null>(null);

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
    return base;
  }, [c, data?.guide, data?.deepGuide]);
  const noteKeys = useMemo(() => slots.map((s) => s.key).filter((k) => k !== COMMITMENT_KEY), [slots]);
  const filled = noteKeys.some((k) => String(notes[k] || '').trim());
  const segment = segmentForPattern(c, status, filled, live);
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
  const screeningOn = has('screening') && screening?.startedAt;
  const now = useNowTick(Boolean(screeningOn));
  const screeningRemain = screeningOn
    ? new Date(screening.startedAt as string).getTime() + (screening.durationMin || 90) * 60000 - now
    : null;

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
          lines: [...(data.guide || []).filter(Boolean), ...(c === 'MONOLOG' ? (data.deepGuide || []).filter(Boolean) : [])].map((g, i) => ({ label: `Q${i + 1}`, body: g })),
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
        { heading: 'Komitmen', lines: [{ body: String(notes[COMMITMENT_KEY] || '') }] },
      ],
      chips: chipLabels,
    });
    downloadBlob(filename, blob);
  }, [data, notes, slots, noteKeys, currentRound, screening, teams, testimony, c, picked]);

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

  const open = (id: string) => canOpenSegmentPattern(c, id, status, filled, live);
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
          ) : (
            <SessionTimer timer={data.timer} />
          )}
        </div>
        {steps.length > 0 && (
          <div className="mt-3 flex gap-1.5">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`flex-1 rounded-full px-2 py-1 text-center text-[10px] font-black ${
                  s.id === segment ? 'bg-[#1B1B1B] text-white' : 'bg-[#FAF9F5] text-[#8C8880]'
                }`}
                title={s.hint}
              >
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {segment === 'komitmen' && (
        <div className={`${CARD} border-brand/40 bg-gradient-to-r from-brand/10 to-brand-end/10`}>
          <p className="text-sm font-black text-[#1B1B1B]">
            Terima kasih, {data.me?.name || 'Peserta'} — yang kamu catat hari ini berarti.
          </p>
          <p className="text-[11px] text-[#8C8880] mt-1">Unduh rekap pribadimu di bawah dan bawa komitmenmu keluar pintu ini.</p>
        </div>
      )}

      {has('guide') && ((data.guide || []).filter(Boolean).length > 0 || (data.deepGuide || []).filter(Boolean).length > 0) && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2">Panduan</h4>
          {c === 'MONOLOG' && (
            <p className="text-[11px] leading-relaxed rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 mb-2">
              Tiap pertanyaan dijawab <b>1–2 perwakilan bergiliran</b> — tidak perlu semua menjawab. Yang lain menulis catatannya di bawah.
            </p>
          )}
          <ol className="space-y-1.5">
            {[...(data.guide || []).filter(Boolean), ...(c === 'MONOLOG' ? (data.deepGuide || []).filter(Boolean) : [])].map((g, i) => (
              <li key={i} className="text-xs leading-relaxed bg-[#FAF9F5] rounded-xl px-3 py-2">
                <b className="mr-1.5">Q{i + 1}.</b>
                {g}
              </li>
            ))}
          </ol>
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
          {screening ? (
            <div className="rounded-xl bg-[#111] text-white p-4 flex items-center justify-between gap-3">
              <p className="text-xs font-bold truncate">{screening.title}</p>
              <p className="text-2xl font-black tabular-nums shrink-0">
                {screeningRemain === null ? '––:––' : fmtRemain(screeningRemain)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#8C8880] italic">Film menyusul — siapkan hati, HP silent.</p>
          )}
        </div>
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
            <Flag className="w-3 h-3" /> Berisi panduan, catatan, dan komitmenmu.
          </p>
        </div>
      )}
    </div>
  );
};
