import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveStage } from '../components/mentoring/StagePanels';
import {
  cleanLabCompleted,
  defaultLabCompleted,
  normalizeLabPhase,
  type LabCompleted,
} from '../lib/lab-step-gate';

export type LabActivityPhase = 'PRE' | 'START' | 'BRIEFING' | 'A1' | 'A2' | 'PRESENT' | 'DONE';

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
  completed: LabCompleted;
};

const defaultActivity = (): LabActivityState => ({
  phase: 'PRE',
  startedAt: null,
  durationSec: 600,
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
  completed: defaultLabCompleted(),
});

async function fetchStageConfig(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Gagal memuat status panggung.');
  return d.session?.config || {};
}

async function ensureSessionRunning(sessionId: string) {
  const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'start' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Error(d?.error || 'Gagal memulai sesi (RUNNING).');
}

export function parseLabActivity(cfg: Record<string, unknown>): LabActivityState {
  const a = cfg.activity && typeof cfg.activity === 'object' ? (cfg.activity as Record<string, unknown>) : {};
  const dur = a.durations && typeof a.durations === 'object' ? (a.durations as Record<string, unknown>) : {};
  const startedAt = (a.startedAt as string) || null;
  const phase = normalizeLabPhase(String(a.phase || 'PRE'), startedAt);
  const phases = ['PRE', 'START', 'BRIEFING', 'A1', 'A2', 'PRESENT', 'DONE'] as const;
  const phaseSafe = (phases as readonly string[]).includes(phase) ? phase : 'PRE';
  return {
    phase: phaseSafe as LabActivityPhase,
    startedAt,
    durationSec: Number(a.durationSec) || Number(dur.A1) || 600,
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
    completed: cleanLabCompleted(a.completed),
  };
}

function shufflePresentOrder(teamCount: number, missing: Set<number>): number[] {
  const arr: number[] = [];
  for (let i = 0; i < teamCount; i += 1) {
    if (!missing.has(i)) arr.push(i);
  }
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
      setBusy(true);
      setNote(null);
      try {
        const cfg = await fetchStageConfig(sessionId);
        const current = parseLabActivity(cfg);
        const next: LabActivityState = {
          ...current,
          ...patch,
          durations: { ...current.durations, ...(patch.durations || {}) },
          completed: { ...current.completed, ...(patch.completed || {}) },
        };
        setActivity(next);
        await saveStage(sessionId, { activity: next });
        if (msg) setNote(msg);
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Gagal menyimpan status.');
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [sessionId, reload],
  );

  const startDraw = useCallback(async () => {
    if (!sessionId) return;
    if (normalizeLabPhase(activity.phase, activity.startedAt) !== 'BRIEFING') {
      setNote('Undian hanya saat fase Briefing.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const cfg = await fetchStageConfig(sessionId);
      const teams = Array.isArray(cfg.teams?.teams) ? cfg.teams.teams : [];
      const presentable = teams
        .map((t: { name?: string; missing?: boolean }, i: number) => (String(t?.name || '').trim() && !t?.missing ? i : -1))
        .filter((i: number) => i >= 0);
      if (!presentable.length) {
        setNote('Muat / isi kelompok dulu sebelum mengundi.');
        return;
      }
      const order = shufflePresentOrder(teams.length, new Set(
        teams.map((t: { missing?: boolean }, i: number) => (t?.missing ? i : -1)).filter((i: number) => i >= 0),
      ));
      const drawnAt = new Date().toISOString();
      const completed = { ...activity.completed, DRAW_AT: drawnAt };
      await pushActivity(
        {
          phase: 'BRIEFING',
          presentStartedAt: null,
          presentOrder: order.length ? order : presentable,
          presentDrawnAt: drawnAt,
          presentIndex: 0,
          presentSlide: 0,
          completed,
        },
        'Undian selesai — isi nama perwakilan, lalu mulai Sesi 1.',
      );
    } finally {
      setBusy(false);
    }
  }, [sessionId, pushActivity, activity.phase, activity.startedAt, activity.completed]);

  const startSession = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await ensureSessionRunning(sessionId);
      const now = new Date().toISOString();
      await pushActivity(
        {
          phase: 'START',
          startedAt: now,
          durationSec: 600,
          presentStartedAt: null,
          completed: { ...defaultLabCompleted(), START_AT: now },
        },
        'Start Sesi — tema & Teks Utama (10 menit).',
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal memulai sesi.');
    } finally {
      setBusy(false);
    }
  }, [sessionId, pushActivity]);

  const startBriefing = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await pushActivity(
        {
          phase: 'BRIEFING',
          startedAt: now,
          durationSec: 300,
          presentStartedAt: null,
          completed: { ...activity.completed, BRIEFING_AT: now },
        },
        'Briefing — perwakilan maju ke depan; undi urutan di panel kontrol.',
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal memulai briefing.');
    } finally {
      setBusy(false);
    }
  }, [sessionId, pushActivity, activity.completed]);

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
      'Presentasi — urutan tampil 1 menit, lalu slide per kelompok.',
    );
  }, [activity.presentSeconds, pushActivity]);

  const openChipsKonklusi = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await pushActivity(
        {
          phase: 'DONE',
          startedAt: now,
          durationSec: 0,
          presentStartedAt: null,
          completed: { ...activity.completed, DONE_AT: now },
        },
        'Konklusi — Lesson Learned dibuka di HP peserta.',
      );
      await saveStage(sessionId, { labChipsOpen: true });
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'wrapup' }),
      });
      if (!r.ok && r.status !== 409) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || 'Gagal membuka wrapup.');
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal membuka konklusi.');
    } finally {
      setBusy(false);
    }
  }, [sessionId, pushActivity, activity.completed]);

  const lockScreen = useCallback(() => {
    void pushActivity({ showOnScreen: false }, 'Layar proyektor dikunci — peserta tetap di HP.');
  }, [pushActivity]);

  const stopTimer = useCallback(
    () => pushActivity({ startedAt: null, presentStartedAt: null }, 'Timer dihentikan (transisi manual).'),
    [pushActivity],
  );

  const resetStage = useCallback(() => {
    if (!window.confirm('Reset panggung ke awal? Timer & fase aktivitas direset — jawaban audiens tidak dihapus.')) return;
    void pushActivity(
      {
        phase: 'PRE',
        startedAt: null,
        presentStartedAt: null,
        cardIndex: 0,
        presentIndex: 0,
        presentSlide: 0,
        presentOrder: [],
        presentDrawnAt: null,
        presentSkipped: [],
        presentPostponed: [],
        showOnScreen: true,
        completed: defaultLabCompleted(),
      },
      'Panggung direset ke awal.',
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
          : activity.phase === 'DONE' ? 'Konklusi'
            : activity.phase === 'BRIEFING' ? 'Briefing'
              : activity.phase === 'START' ? 'Start Sesi'
                : 'Menunggu Start Sesi';

  return useMemo(
    () => ({
      activity,
      busy,
      note,
      reload,
      pushActivity,
      startDraw,
      startSession,
      startBriefing,
      startPhase,
      startPresent,
      openChipsKonklusi,
      lockScreen,
      stopTimer,
      resetStage,
      extendActivityPhase,
      remainingMs,
      phaseLabel,
      setActivity,
    }),
    [
      activity,
      busy,
      note,
      reload,
      pushActivity,
      startDraw,
      startSession,
      startBriefing,
      startPhase,
      startPresent,
      openChipsKonklusi,
      lockScreen,
      stopTimer,
      resetStage,
      extendActivityPhase,
      remainingMs,
      phaseLabel,
    ],
  );
}
