import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveStage } from '../components/mentoring/StagePanels';

export type LabActivityPhase = 'DRAW' | 'IDLE' | 'A1' | 'A2' | 'PRESENT' | 'DONE';

export type LabActivityState = {
  phase: LabActivityPhase;
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

const defaultActivity = (): LabActivityState => ({
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

async function fetchStageConfig(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal memuat status panggung.');
  return d.session?.config || {};
}

export function parseLabActivity(cfg: Record<string, unknown>): LabActivityState {
  const a = cfg.activity && typeof cfg.activity === 'object' ? (cfg.activity as Record<string, unknown>) : {};
  const dur = a.durations && typeof a.durations === 'object' ? (a.durations as Record<string, unknown>) : {};
  const phaseRaw = String(a.phase || 'IDLE').toUpperCase();
  const phase = (['DRAW', 'IDLE', 'A1', 'A2', 'PRESENT', 'DONE'] as const).includes(phaseRaw as LabActivityPhase)
    ? (phaseRaw as LabActivityPhase)
    : 'IDLE';
  return {
    phase,
    startedAt: (a.startedAt as string) || null,
    durationSec: Number(a.durationSec) || Number(dur.A1) || 900,
    showOnScreen: a.showOnScreen !== false,
    cardIndex: Math.min(5, Math.max(0, Number(a.cardIndex) || 0)),
    presentIndex: Math.min(9, Math.max(0, Number(a.presentIndex) || 0)),
    presentSlide: Math.min(2, Math.max(0, Math.floor(Number(a.presentSlide) || 0))),
    presentStartedAt: (a.presentStartedAt as string) || null,
    presentSeconds: Number(a.presentSeconds) || Number(dur.PRESENT) || 150,
    presentOrder: Array.isArray(a.presentOrder) ? a.presentOrder.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [],
    presentSkipped: Array.isArray(a.presentSkipped) ? a.presentSkipped.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [],
    presentPostponed: Array.isArray(a.presentPostponed) ? a.presentPostponed.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [],
    presentDrawnAt: (a.presentDrawnAt as string) || null,
    durations: {
      A1: Number(dur.A1) || 900,
      A2: Number(dur.A2) || 1500,
      PRESENT: Number(dur.PRESENT) || Number(a.presentSeconds) || 150,
    },
  };
}

export function useLabActivity(sessionId: string | null) {
  const [activity, setActivity] = useState<LabActivityState>(defaultActivity());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    const cfg = await fetchStageConfig(sessionId);
    setActivity(parseLabActivity(cfg));
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pushActivity = useCallback(
    async (patch: Partial<LabActivityState>, msg?: string) => {
      if (!sessionId) return;
      const next: LabActivityState = {
        ...activity,
        ...patch,
        durations: { ...activity.durations, ...(patch.durations || {}) },
      };
      setActivity(next);
      setBusy(true);
      setNote(null);
      try {
        await saveStage(sessionId, { activity: next });
        if (msg) setNote(msg);
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Gagal menyimpan status.');
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [activity, sessionId, reload],
  );

  const startDraw = useCallback(
    () => pushActivity(
      { phase: 'DRAW', startedAt: new Date().toISOString(), durationSec: 300, presentStartedAt: null },
      'Undian — tampilkan nomor grup di layar.',
    ),
    [pushActivity],
  );

  const startBriefing = useCallback(
    () => pushActivity(
      { phase: 'IDLE', startedAt: new Date().toISOString(), durationSec: 900, presentStartedAt: null },
      'Firman & Briefing 15 menit — 10 menit judul firman, 5 menit panggil perwakilan.',
    ),
    [pushActivity],
  );

  const startPhase = useCallback(
    (phase: 'A1' | 'A2') => {
      const startedAt = new Date().toISOString();
      const seconds = phase === 'A1' ? activity.durations.A1 : activity.durations.A2;
      void pushActivity(
        { phase, startedAt, durationSec: seconds, presentStartedAt: null },
        phase === 'A1' ? 'Sesi 1 berjalan — Reminder Jar.' : 'Sesi 2 berjalan — Art Stations paralel.',
      );
    },
    [activity.durations.A1, activity.durations.A2, pushActivity],
  );

  const startPresent = useCallback(() => {
    const startedAt = new Date().toISOString();
    void pushActivity(
      {
        phase: 'PRESENT',
        startedAt,
        presentStartedAt: startedAt,
        durationSec: activity.presentSeconds,
        presentSlide: 0,
      },
      'Presentasi Kelompok dimulai.',
    );
  }, [activity.presentSeconds, pushActivity]);

  const stopTimer = useCallback(
    () => pushActivity({ startedAt: null, presentStartedAt: null }, 'Timer dihentikan (transisi manual).'),
    [pushActivity],
  );

  const resetStage = useCallback(() => {
    if (!window.confirm('Reset panggung ke Undian? Timer & fase aktivitas direset — jawaban audiens tidak dihapus.')) return;
    void pushActivity(
      { phase: 'DRAW', startedAt: null, presentStartedAt: null, cardIndex: 0, presentIndex: 0, presentSlide: 0 },
      'Panggung direset ke Undian.',
    );
  }, [pushActivity]);

  const extendActivityPhase = useCallback(
    async (seconds: number) => {
      if (!sessionId) return;
      if (!activity.startedAt && !activity.presentStartedAt) {
        setNote('Belum ada timer fase aktivitas yang berjalan.');
        return;
      }
      const add = Math.min(1800, Math.max(5, Math.round(seconds)));
      const patch: Partial<LabActivityState> = activity.presentStartedAt
        ? { presentSeconds: activity.presentSeconds + add }
        : { durationSec: activity.durationSec + add };
      await pushActivity(patch, `Timer fase +${add >= 60 ? `${Math.round(add / 60)} mnt` : `${add} dtk`}.`);
    },
    [activity, pushActivity, sessionId],
  );

  const remainingMs = useMemo(() => {
    const now = Date.now();
    if (activity.phase === 'PRESENT' && activity.presentStartedAt) {
      return activity.presentSeconds * 1000 - (now - Date.parse(activity.presentStartedAt));
    }
    if (activity.startedAt) return activity.durationSec * 1000 - (now - Date.parse(activity.startedAt));
    return activity.durationSec * 1000;
  }, [activity]);

  const phaseLabel =
    activity.phase === 'A1' ? 'Sesi 1 · Reminder Jar'
      : activity.phase === 'A2' ? 'Sesi 2 · Art Stations'
        : activity.phase === 'PRESENT' ? 'Presentasi Kelompok'
          : activity.phase === 'DRAW' ? 'Undian'
            : activity.phase === 'DONE' ? 'Selesai'
              : activity.phase === 'IDLE' && activity.startedAt ? 'Briefing'
                : 'Belum mulai';

  return {
    activity,
    busy,
    note,
    reload,
    pushActivity,
    startDraw,
    startBriefing,
    startPhase,
    startPresent,
    stopTimer,
    resetStage,
    extendActivityPhase,
    remainingMs,
    phaseLabel,
    setActivity,
  };
}
