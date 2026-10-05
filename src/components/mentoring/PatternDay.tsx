import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clapperboard, Download, Flag, Loader2, Swords, Users } from 'lucide-react';
import {
  COMMITMENT_KEY,
  PATTERN_SEGMENTS,
  canOpenSegmentPattern,
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
  const slots = useMemo(() => {
    const base = noteSlotsFor(c);
    if (c === 'MONOLOG' && (data?.guide || []).filter(Boolean).length >= 3) {
      const keys = ['FGD-OBSERVE', 'FGD-INTERPRET', 'FGD-APPLY'];
      return [
        ...keys.map((key, i) => ({
          key,
          label: `Q${i + 1} — ${data?.guide?.[i]}`,
          placeholder: base[i]?.placeholder || '',
        })),
        base[base.length - 1],
      ];
    }
    return base;
  }, [c, data?.guide]);
  const noteKeys = useMemo(() => slots.map((s) => s.key).filter((k) => k !== COMMITMENT_KEY), [slots]);
  const filled = noteKeys.some((k) => String(notes[k] || '').trim());
  const segment = segmentForPattern(c, status, filled);
  const steps = PATTERN_SEGMENTS[c] || [];
  const widgets = widgetsFor(c, segment);
  const has = (w: SegmentWidget) => widgets.includes(w);

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

  const download = useCallback(() => {
    if (!data) return;
    const slotLabel = (key: string) => slots.find((s) => s.key === key)?.label || key;
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
          lines: (data.guide || []).filter(Boolean).map((g, i) => ({ label: `Q${i + 1}`, body: g })),
        },
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
    });
    downloadBlob(filename, blob);
  }, [data, notes, slots, noteKeys, currentRound, screening, teams, testimony, c]);

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

  const open = (id: string) => canOpenSegmentPattern(c, id, status, filled);
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
          <SessionTimer timer={data.timer} />
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

      {has('guide') && (data.guide || []).filter(Boolean).length > 0 && (
        <div className={CARD}>
          <h4 className="text-sm font-black text-[#1B1B1B] mb-2">Panduan</h4>
          <ol className="space-y-1.5">
            {(data.guide || []).filter(Boolean).map((g, i) => (
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
                <span className="text-[10px] text-[#8C8880]">{p.role}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {has('notes') && (
        <SessionNotes slots={slots} values={notes} onSave={saveNote} disabled={!editable} />
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
