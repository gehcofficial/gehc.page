import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  KeyRound,
  Loader2,
  MapPin,
  MonitorPlay,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import {
  STATUS_LABELS,
  type MentoringLivePayload,
  type MentoringStatus,
} from '../../lib/mentoring';
import { fetchWithEtag, startVisiblePoll } from '../../lib/visible-poll';
import { lastPortalPlace } from '../../lib/portal-place';
import { preferSession, sessionOptionLabel } from '../../lib/worship-session-select';
import { sessionHasDraftContent } from '../../lib/worship-session-draft';
import { PatternRundownList } from './PatternRundownList';
import { TestimonyPanel } from './TestimonyPanel';
import { ActivityPanel, DebatPanel, ScreeningPanel, TeamsPanel, saveStage } from './StagePanels';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand';

type SessionRow = {
  id: string;
  slug: string;
  title: string;
  status: MentoringStatus;
  sessionDate?: string | null;
  accessCode?: string | null;
  eventId?: string | null;
  pattern?: { code: string; name: string } | null;
};

type ItemRow = { id: string; topicCode: string; text: string; gospelNote?: string | null; sortOrder: number };
type ChipRow = { id: string; code: string; label: string; topicCode?: string | null; sortOrder: number };

type NoteRow = { userId: string; userName: string; topicCode: string; content: string };
type SessionDetail = {
  permissions?: { canWrite: boolean };
  session: {
    id: string;
    slug: string;
    title: string;
    status: MentoringStatus;
    sessionDate?: string | null;
    accessCode?: string | null;
    eventId?: string | null;
    config: {
      timerSeconds: number;
      topics: { code: string; label: string }[];
      floors: { floor: number; label: string; venueId?: string | null; capacity?: number }[];
      rankFloors?: number[];
      expectedCount: number | null;
      chipLimit: number;
      phasePrefs?: Record<string, { durationSec: number; showOnScreen: boolean }> | null;
      draft?: Record<string, unknown> | null;
    };
    pattern?: { code: string; name: string; phases?: { no?: number; title?: string; minutes?: number; owner?: string; division?: string | null }[] } | null;
  };
  likertItems: ItemRow[];
  chips: ChipRow[];
  rooms: { code: string; label: string; floorLabel: string; count: number; total: number; capacity?: number; isFull?: boolean }[];
  wordcloud: { code: string; label: string; count: number }[];
  notes?: NoteRow[];
  progress: { submitted: number; total: number };
};

type VenueRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  kind: string;
  note?: string | null;
  isActive: boolean;
};

const ACTIONS: { action: string; label: string; tone: string }[] = [
  { action: 'open-likert', label: 'Buka Akses Likert', tone: 'bg-sky-600' },
  { action: 'start', label: 'Start Sesi', tone: 'bg-emerald-600' },
  { action: 'wrapup', label: 'Trigger Lesson Learned', tone: 'bg-amber-600' },
  { action: 'extend', label: '+5 menit', tone: 'bg-sky-500' },
  { action: 'close', label: 'Tutup Sesi', tone: 'bg-[#1B1B1B]' },
  { action: 'reset', label: 'Reset ke Draft', tone: 'bg-white !text-[#8C8880] border border-[#D9D7D0]' },
];

export const MentoringControl: React.FC<{ initialSlug?: string; eventId?: string | null; preferPattern?: string | null; standalone?: boolean }> = ({ initialSlug, eventId, preferPattern, standalone = false }) => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [onlyEvent, setOnlyEvent] = useState(true);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [slugMiss, setSlugMiss] = useState(false);
  const [live, setLive] = useState<MentoringLivePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [newItem, setNewItem] = useState({ topicCode: '', text: '', gospelNote: '' });
  const [newChip, setNewChip] = useState({ label: '', topicCode: '' });
  const [configDraft, setConfigDraft] = useState({ timerSeconds: 1200, expectedCount: '' });
  const [briefingDraft, setBriefingDraft] = useState({ scribe: '', draw: '' });
  /** Chip tambah waktu fleksibel (+5/+60/+300 dtk + custom 5–1800). */
  const renderExtendChips = (run: (sec: number) => void, canRun: boolean) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">+ waktu:</span>
      {[
        { sec: 5, label: '+5 dtk' },
        { sec: 60, label: '+1 mnt' },
        { sec: 300, label: '+5 mnt' },
      ].map((p) => (
        <button
          key={p.sec}
          type="button"
          disabled={busy || !canRun}
          onClick={() => run(p.sec)}
          className="px-3 py-2 rounded-full text-[11px] font-bold text-white disabled:opacity-60 bg-sky-500"
        >
          {p.label}
        </button>
      ))}
      <input
        type="number"
        min={5}
        max={1800}
        value={extendCustom}
        onChange={(e) => setExtendCustom(e.target.value)}
        placeholder="dtk…"
        title="Custom detik (5–1800)"
        className="w-20 px-2.5 py-2 rounded-full text-[11px] font-bold border border-[#D9D7D0] focus:outline-none focus:border-brand"
      />
      <button
        type="button"
        disabled={busy || !canRun || !Number(extendCustom)}
        onClick={() => { run(Number(extendCustom)); setExtendCustom(''); }}
        className="px-3 py-2 rounded-full text-[11px] font-bold text-white disabled:opacity-60 bg-sky-700"
      >
        +custom
      </button>
    </div>
  );
  const [phasePrefsDraft, setPhasePrefsDraft] = useState<Record<string, { min: string; show: boolean }>>({
    F1: { min: '20', show: true },
    F2: { min: '25', show: true },
    F3: { min: '10', show: true },
    CLOSING: { min: '5', show: true },
  });
  /** Tambah waktu fleksibel: preset + custom (detik, 5–1800). */
  const [extendCustom, setExtendCustom] = useState('');
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [rankVenues, setRankVenues] = useState<string[]>(['', '', '']);
  const [venueDraft, setVenueDraft] = useState({ name: '', capacity: '', kind: 'TERAS', note: '' });
  const [venueEdit, setVenueEdit] = useState<Record<string, { capacity: string; note: string }>>({});

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const applyDetail = useCallback((d: SessionDetail) => {
    setDetail(d);
    setSlugMiss(false);
    setConfigDraft({
      timerSeconds: d.session?.config?.timerSeconds ?? 1200,
      expectedCount: d.session?.config?.expectedCount ?? '',
    });
    const rawDraft = d.session?.config?.draft;
    const briefing = rawDraft && typeof rawDraft.briefing === 'object' && rawDraft.briefing
      ? rawDraft.briefing as Record<string, unknown>
      : {};
    setBriefingDraft({
      scribe: String(briefing['brief-scribe'] || ''),
      draw: String(briefing['brief-draw'] || ''),
    });
    const pp = d.session?.config?.phasePrefs;
    if (pp && typeof pp === 'object') {
      setPhasePrefsDraft((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          const row = (pp as Record<string, { durationSec?: number; showOnScreen?: boolean }>)[k];
          if (row && typeof row === 'object') {
            if (Number(row.durationSec) > 0) next[k] = { ...next[k], min: String(Math.round(Number(row.durationSec) / 60)) };
            if (row.showOnScreen !== undefined) next[k] = { ...next[k], show: row.showOnScreen !== false };
          }
        }
        return next;
      });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSlugMiss(false);
    try {
      const slugPromise = initialSlug
        ? fetch(`/api/worship/sessions/${encodeURIComponent(initialSlug)}`, { credentials: 'include' })
        : null;
      const r = await fetch('/api/worship/sessions', { credentials: 'include' });
      if (r.status === 401) {
        const next = window.location.hash || `#/mentoring/${initialSlug || ''}/kontrol`;
        window.location.hash = `#/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat sesi.');
      let list: SessionRow[] = d.sessions || [];
      const rowFrom = (s: SessionDetail['session']): SessionRow => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        status: s.status,
        sessionDate: s.sessionDate,
        accessCode: s.accessCode,
        eventId: s.eventId,
        pattern: s.pattern ? { code: s.pattern.code, name: s.pattern.name } : null,
      });
      if (initialSlug && slugPromise) {
        const one = await slugPromise;
        if (one.status === 401) {
          const next = window.location.hash || `#/mentoring/${initialSlug}/kontrol`;
          window.location.hash = `#/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (one.ok) {
          const body = await one.json() as SessionDetail;
          const s = body?.session;
          if (s?.id) {
            if (!list.some((row) => row.id === s.id)) list = [rowFrom(s), ...list];
            setSessions(list);
            setSelectedId(s.id);
            applyDetail(body);
            return;
          }
        }
        const known = list.find((row) => String(row.slug || '').toLowerCase() === initialSlug.toLowerCase());
        setSessions(list);
        if (known) {
          setSelectedId(known.id);
          return;
        }
        setSelectedId('');
        setDetail(null);
        setSlugMiss(true);
        return;
      }
      setSessions(list);
      setSelectedId((prev) => preferSession(list, { prevId: prev, slug: initialSlug, eventId, preferPattern }));
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat sesi.' });
    } finally {
      setSessionsLoading(false);
    }
  }, [initialSlug, eventId, preferPattern, applyDetail]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(selectedId)}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat detail sesi.');
      applyDetail(d);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat detail.' });
    }
  }, [selectedId, applyDetail]);

  const liveEtag = useRef({ etag: null as string | null });
  const loadLive = useCallback(async () => {
    if (!detail?.session?.slug) return false;
    try {
      const polled = await fetchWithEtag(
        `/api/worship/live/${encodeURIComponent(detail.session.slug)}`,
        liveEtag.current,
        { credentials: 'include' },
      );
      if (polled.unchanged) return false;
      if (!polled.response.ok) return true;
      setLive(polled.data as typeof live);
      return true;
    } catch {
      return true;
    }
  }, [detail?.session?.slug]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  useEffect(() => startVisiblePoll(() => loadLive(), 15000, 30000), [loadLive]);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!detail) return;
    if (action === 'reset') {
      const ok = window.confirm(
        'Reset ke Draft menghapus jawaban audiens (Likert, vote, catatan, kesaksian, screening, fase, trigger, chip) plus karya Creative Lab, status aktivitas, dan tanda selesai tim. Roster tim tetap. Soal + Lesson Learned master tetap. Lanjut?',
      );
      if (!ok) return;
    }
    if (action === 'start') {
      const code = String(detail.session.pattern?.code || '').toUpperCase();
      const p = live?.progress || detail.progress;
      if (p && p.submitted < p.total && code === 'POST_TO_POST') {
        const ok = window.confirm(
          `Baru ${p.submitted}/${p.total} peserta mengisi Likert. Tetap mulai sesi 20 menit?`,
        );
        if (!ok) return;
      }
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal mengubah status.');
      setMsg({ kind: 'ok', text: `Status: ${d.status}` });
      await loadDetail();
      await loadLive();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal mengubah status.' });
    } finally {
      setBusy(false);
    }
  };

  // Gate Likert 2 ronde film (M0 buka AWAL → M1 kunci AWAL → M3 buka AKHIR).
  const filmSetRounds = async (pre: 'open' | 'closed', post: 'open' | 'closed', label: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      await saveStage(detail.session.id, { likertRounds: { pre, post } });
      setMsg({ kind: 'ok', text: label });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan gate.' });
    } finally {
      setBusy(false);
    }
  };

  // Langkah debat hari-H: simpan patch ke config.rounds TANPA menghapus
  // mosi/tim/juri (server mengganti seluruh objek rounds tiap PUT).
  const debatStage = async (patch: Record<string, unknown>, label: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const cur = detail.session.config?.rounds && typeof detail.session.config.rounds === 'object'
        ? (detail.session.config.rounds as Record<string, unknown>)
        : {};
      await saveStage(detail.session.id, { rounds: { ...cur, ...patch } });
      setMsg({ kind: 'ok', text: label });
      await loadDetail();
      await loadLive();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan langkah debat.' });
    } finally {
      setBusy(false);
    }
  };

  // Durasi tiap fase (detik) dari pengaturan kontrol; fallback baku 20/25/10/5.
  const prefSec = (name: string): number => {
    const mins = Number(phasePrefsDraft[name]?.min);
    const fallback = { F1: 1200, F2: 1500, F3: 600, CLOSING: 300 }[name] || 300;
    if (!Number.isFinite(mins) || mins <= 0) return fallback;
    return Math.min(7200, Math.max(60, Math.round(mins * 60)));
  };
  const prefShow = (name: string): boolean => phasePrefsDraft[name]?.show !== false;

  const savePhasePrefs = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const prefs: Record<string, { durationSec: number; showOnScreen: boolean }> = {};
      for (const name of ['F1', 'F2', 'F3', 'CLOSING']) {
        prefs[name] = { durationSec: prefSec(name), showOnScreen: prefShow(name) };
      }
      await saveStage(detail.session.id, { phasePrefs: prefs });
      setMsg({ kind: 'ok', text: 'Pengaturan fase tersimpan — dipakai mulai fase berikutnya.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan pengaturan fase.' });
    } finally {
      setBusy(false);
    }
  };

  // 4 tombol fase MONOLOG (durasi + tampil ikut pengaturan di atas).
  // Transisi manual; T1/T3 via state, T2/T4 via stage.
  const monologPhase = async (name: 'F2' | 'CLOSING') => {
    if (!detail) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> =
        name === 'F2'
          ? {
              fgd: { currentQ: 5, triggerBy: null, triggerName: null },
              phase: { name: 'F2', startedAt: new Date().toISOString(), durationSec: prefSec('F2'), showOnScreen: prefShow('F2') },
            }
          : { phase: { name: 'CLOSING', startedAt: new Date().toISOString(), durationSec: prefSec('CLOSING'), showOnScreen: prefShow('CLOSING') } };
      await saveStage(detail.session.id, patch);
      const mins = Math.round(prefSec(name) / 60);
      setMsg({ kind: 'ok', text: name === 'F2' ? `Sesi 2 · Deep Sharing dibuka, Q4–Q5 ikut terbuka (${mins} menit).` : `Konklusi dibuka (${mins} menit).` });
      await loadDetail();
      await loadLive();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal membuka fase.' });
    } finally {
      setBusy(false);
    }
  };

  const startWithPrefs = async (base: 'start' | 'wrapup', phaseName: 'F1' | 'F3') => {
    await doAction(base);
    if (!detail) return;
    try {
      await saveStage(detail.session.id, {
        phase: {
          name: phaseName,
          startedAt: new Date().toISOString(),
          durationSec: prefSec(phaseName),
          showOnScreen: prefShow(phaseName),
        },
      });
      await loadDetail();
      await loadLive();
    } catch {
      /* fase baku server tetap jalan */
    }
  };

  const extendPhase = async (seconds?: number) => {
    if (!detail) return;
    const cur = live?.phase;
    if (!cur?.startedAt) {
      setMsg({ kind: 'err', text: 'Belum ada fase berjalan.' });
      return;
    }
    const add = Math.min(1800, Math.max(5, Math.round(Number(seconds) || 300)));
    setBusy(true);
    try {
      await saveStage(detail.session.id, {
        phase: { name: cur.name, startedAt: cur.startedAt, durationSec: Number(cur.durationSec) + add, showOnScreen: (cur as { showOnScreen?: boolean }).showOnScreen !== false },
      });
      const label = add >= 60 ? `${Math.round(add / 60)} menit` : `${add} detik`;
      setMsg({ kind: 'ok', text: `Fase ${cur.name} ditambah ${label}.` });
      await loadDetail();
      await loadLive();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah waktu.' });
    } finally {
      setBusy(false);
    }
  };

  const rotateCode = async () => {    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rotateCode: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal merotasi kode.');
      setMsg({ kind: 'ok', text: `Kode baru: ${d.session.accessCode}` });
      await loadDetail();
      await loadSessions();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal merotasi kode.' });
    } finally {
      setBusy(false);
    }
  };

  const saveBriefing = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const cfg = detail.session.config;
      const draft = cfg.draft && typeof cfg.draft === 'object' ? { ...cfg.draft } : {};
      const briefing = draft.briefing && typeof draft.briefing === 'object'
        ? { ...(draft.briefing as Record<string, unknown>) }
        : {};
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: {
            ...cfg,
            draft: {
              ...draft,
              briefing: {
                ...briefing,
                'brief-scribe': briefingDraft.scribe,
                'brief-draw': briefingDraft.draw,
              },
            },
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan briefing.');
      setMsg({ kind: 'ok', text: 'Pengumuman pencatat dan pengundian tersimpan. Layar menampilkannya.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan briefing.' });
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: {
            ...detail.session.config,
            timerSeconds: Number(configDraft.timerSeconds) || 1200,
            expectedCount: configDraft.expectedCount === '' ? null : Number(configDraft.expectedCount),
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan konfigurasi.');
      setMsg({ kind: 'ok', text: 'Konfigurasi tersimpan.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan konfigurasi.' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const r = await fetch('/api/worship/venues?active=0', { credentials: 'include' });
      const d = r.ok ? await r.json() : { venues: [] };
      setVenues((d.venues || []) as VenueRow[]);
    } catch {
      setVenues([]);
    }
  };

  // rankVenues[i] = venueId untuk prioritas rank i+1.
  useEffect(() => {
    const cfg = detail?.session.config;
    if (!cfg) return;
    const ranks: number[] = Array.isArray(cfg.rankFloors) && cfg.rankFloors.length === 3 ? cfg.rankFloors : [1, 2, 3];
    setRankVenues(
      ranks.map((floor) => cfg.floors.find((f) => f.floor === floor)?.venueId || ''),
    );
  }, [detail?.session.id]);

  const venueTotal = rankVenues.reduce((n, id) => {
    const v = venues.find((x) => x.id === id);
    return n + (v?.capacity || 0);
  }, 0);

  const saveVenues = async () => {
    if (!detail) return;
    const picked = rankVenues.map((id) => venues.find((v) => v.id === id));
    if (picked.some((v) => !v)) {
      setMsg({ kind: 'err', text: 'Pilih tempat untuk Rank 1, 2, dan 3.' });
      return;
    }
    if (new Set(rankVenues).size !== rankVenues.length) {
      setMsg({ kind: 'err', text: 'Tiga rank harus memakai tempat berbeda.' });
      return;
    }
    setBusy(true);
    try {
      const floors = picked.map((v, i) => ({
        floor: i + 1,
        label: v?.name || `Pos ${i + 1}`,
        venueId: v?.id || null,
        capacity: v?.capacity || 0,
      }));
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: { ...detail.session.config, floors, rankFloors: [1, 2, 3] },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan tempat.');
      setMsg({ kind: 'ok', text: 'Tempat pos tersimpan.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const addVenue = async () => {
    if (!venueDraft.name.trim()) {
      setMsg({ kind: 'err', text: 'Nama tempat wajib diisi.' });
      return;
    }
    setBusy(true);
    try {
      const code = venueDraft.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || `V${Date.now().toString(36).toUpperCase()}`;
      const r = await fetch('/api/worship/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          name: venueDraft.name.trim(),
          capacity: Number(venueDraft.capacity) || 0,
          kind: venueDraft.kind,
          note: venueDraft.note.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah tempat.');
      setVenueDraft({ name: '', capacity: '', kind: 'TERAS', note: '' });
      setMsg({ kind: 'ok', text: 'Tempat ditambahkan.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const patchVenue = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/venues/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan tempat.');
      setMsg({ kind: 'ok', text: 'Tempat diperbarui.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteVenue = async (id: string, name: string) => {
    if (!window.confirm(`Hapus tempat "${name}"? Hanya bisa bila tidak dipakai sesi mana pun.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/venues/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menghapus.');
      setMsg({ kind: 'ok', text: 'Tempat dihapus.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus.' });
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    if (!detail || !newItem.topicCode || !newItem.text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/likert-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newItem),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah pertanyaan.');
      setNewItem({ topicCode: newItem.topicCode, text: '', gospelNote: '' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah pertanyaan.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/likert-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Gagal menghapus pertanyaan.');
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus.' });
    } finally {
      setBusy(false);
    }
  };

  const addChip = async () => {
    if (!detail || !newChip.label.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/chips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: newChip.label, topicCode: newChip.topicCode || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah chip.');
      setNewChip({ label: '', topicCode: newChip.topicCode });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah chip.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteChip = async (code: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/worship/sessions/${detail.session.id}/chips/${encodeURIComponent(code)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!r.ok) throw new Error('Gagal menghapus chip.');
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus chip.' });
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setMsg({ kind: 'ok', text: 'Tautan disalin.' });
  };

  const links = useMemo(() => {
    const slug = detail?.session.slug || '';
    return {
      peserta: `${origin}/#/mentoring/${slug}`,
      layar: `${origin}/#/mentoring/${slug}/layar${detail?.session.accessCode ? `?code=${encodeURIComponent(detail.session.accessCode)}` : ''}`,
      kontrol: `${origin}/#/mentoring/${slug}/kontrol`,
    };
  }, [detail?.session.slug, detail?.session.accessCode, origin]);

  const patternCode = String(detail?.session?.pattern?.code || '').toUpperCase();
  const isPostToPost = patternCode === 'POST_TO_POST';
  const isMonolog = patternCode === 'MONOLOG';
  const isFilm = patternCode === 'BEDAH_FILM';
  const isDebat = patternCode === 'DEBAT';
  const isCreativeLab = patternCode === 'CREATIVE_LAB';
  const debatRoundsState = (detail?.session?.config?.rounds || null) as { rounds?: unknown[]; current?: number; step?: number } | null;
  const debatRoundCount = Array.isArray(debatRoundsState?.rounds) ? debatRoundsState.rounds.length : 0;
  const debatCurrent = Number(debatRoundsState?.current) || 0;
  const canManageChips = isPostToPost || isMonolog || isFilm || isCreativeLab;
  // Siklus ideal: kontrol mengikuti hanya setelah draft terisi. Tanpa isi,
  // semua tombol aksi dikunci (link + pilihan sesi tetap bisa dipakai).
  const hasDraft = useMemo(
    () => sessionHasDraftContent(
      detail ? { config: detail.session.config, likertItems: detail.likertItems, chips: detail.chips } : null,
    ),
    [detail],
  );
  const [showArchive, setShowArchive] = useState(false);
  const canWrite = detail?.permissions?.canWrite !== false;
  const visibleSessions = useMemo(() => {
    let rows = sessions;
    if (onlyEvent && eventId) {
      const forEvent = sessions.filter((s) => s.eventId === eventId);
      if (forEvent.length) rows = forEvent;
    }
    if (!showArchive) {
      const cutoff = Date.now() - 28 * 24 * 3600 * 1000;
      const filtered = rows.filter((s) => {
        if (String(s.status || '').toUpperCase() !== 'CLOSED') return true;
        const t = s.sessionDate ? new Date(String(s.sessionDate)).getTime() : NaN;
        if (Number.isNaN(t)) return true;
        return t >= cutoff;
      });
      if (filtered.length) rows = filtered;
    }
    const pin = (row: SessionRow | undefined) => {
      if (row && !rows.some((s) => s.id === row.id)) rows = [row, ...rows];
    };
    if (initialSlug) pin(sessions.find((s) => String(s.slug || '').toLowerCase() === initialSlug.toLowerCase()));
    if (selectedId) pin(sessions.find((s) => s.id === selectedId));
    return rows;
  }, [sessions, onlyEvent, eventId, showArchive, initialSlug, selectedId]);
  const archivedCount = sessions.length - visibleSessions.length;
  const visibleActions = useMemo(
    () => (isPostToPost ? ACTIONS : ACTIONS.filter((a) => a.action !== 'open-likert')),
    [isPostToPost],
  );

  const backHref = standalone ? lastPortalPlace('#/portal') : '';
  return (
    <div className={standalone ? 'min-h-screen bg-[#FAF9F5] text-[#1B1B1B]' : ''}>
    <div className={standalone ? 'max-w-5xl mx-auto p-4 md:p-6 space-y-4' : 'space-y-4'}>
      {standalone && (
        <a href={backHref} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]">
          ← Kembali ke portal
        </a>
      )}
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Pola Ibadah &amp; Mentoring Day</h3>
          <button
            type="button"
            onClick={() => void loadSessions()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat ulang
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-[#8C8880]">
              Sesi{eventId ? ' event ini' : ''}
              {eventId && (
                <button
                  type="button"
                  onClick={() => setOnlyEvent((v) => !v)}
                  className="ml-2 font-bold text-brand hover:underline"
                >
                  {onlyEvent ? 'Semua 50' : 'Hanya event ini'}
                </button>
              )}
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchive((v) => !v)}
                  className="ml-2 font-bold text-[#8C8880] hover:text-[#1B1B1B]"
                >
                  {showArchive ? 'Sembunyikan arsip' : `Arsip (${archivedCount})`}
                </button>
              )}
            </span>
            <select className={INPUT} value={selectedId} onChange={(e) => { setSlugMiss(false); setSelectedId(e.target.value); }}>
              {visibleSessions.length === 0 && <option value="">(belum ada sesi)</option>}
              {visibleSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionOptionLabel(s, STATUS_LABELS[s.status])}
                </option>
              ))}
            </select>
          </label>
          {detail?.session?.pattern && (
            <div className="space-y-1">
              <span className="text-[11px] text-[#8C8880]">Pola sesi</span>
              <p className="text-sm font-bold">
                {detail.session.pattern.name}{' '}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold">
                  {patternCode} · {detail.session.slug}
                </span>
              </p>
            </div>
          )}
        </div>
        {msg && (
          <p className={`mt-3 text-xs ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
        )}
      </div>

      {(sessionsLoading || selectedId) && !detail && (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4">
          <p className="text-xs text-[#8C8880] inline-flex items-center gap-1.5">
            <Loader2 className={`w-3.5 h-3.5 ${sessionsLoading || !msg ? 'animate-spin' : ''}`} />
            {msg?.kind === 'err' ? msg.text : 'Memuat kontrol sesi…'}
          </p>
        </div>
      )}

      {!sessionsLoading && !detail && !selectedId && (
        <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white p-4">
          <p className="text-xs font-black text-[#1B1B1B]">
            {slugMiss ? 'Sesi pada tautan ini tidak ditemukan.' : 'Belum ada sesi untuk pekan ini.'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8C8880]">
            {msg?.kind === 'err'
              ? msg.text
              : slugMiss
                ? `Tidak ada sesi dengan slug ${initialSlug}. Pilih sesi lain di daftar, atau buka kontrol dari tab Pola & Sesi.`
                : eventId
                  ? 'Pilih pola di tab Katalog lalu terapkan ke pekan ini — draft kosong akan dibuatkan, isi dulu baru kontrol mengikuti.'
                  : 'Pilih event dulu, atau buat sesi manual dari tab Draft.'}
          </p>
        </div>
      )}

      {detail && (
        <>
          {!canWrite && (
            <div className="rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3">
              <p className="text-xs font-black text-sky-900">Mode lihat-saja — kendali oleh tim Didaskalia/Komisi.</p>
              <p className="mt-0.5 text-[11px] text-sky-800">Rundown & status sesi tetap tampil lengkap. Tombol aksi hari-H hanya aktif untuk pengurus Didaskalia, Komisi, atau Komite BOD.</p>
            </div>
          )}
          {!hasDraft && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-xs font-black text-amber-900">Draft sesi ini belum terisi — kontrol mengikuti setelah draft diisi.</p>
              <p className="mt-0.5 text-[11px] text-amber-800">Isi dari tab Draft (manual atau AI) lalu Terapkan ke sesi. Tombol hari-H di bawah aktif setelah itu.</p>
            </div>
          )}
          <PatternRundownList patternName={detail.session.pattern?.name} phases={detail.session.pattern?.phases} />
          <fieldset disabled={!hasDraft || !canWrite} className={`min-w-0 border-0 p-0 m-0 space-y-4 ${(!hasDraft || !canWrite) ? 'opacity-70' : ''}`}>
          <div className={CARD}>
            <div className="flex flex-wrap items-center gap-2">
              {isMonolog ? (
                <>
                  {(
                    [
                      { key: 'F1', label: `Sesi 1 · Bedah Lagu · ${Math.round(prefSec('F1') / 60)}’`, run: () => void startWithPrefs('start', 'F1'), on: detail.session.status === 'DRAFT' },
                      { key: 'F2', label: `Sesi 2 · Deep Sharing · ${Math.round(prefSec('F2') / 60)}’`, run: () => void monologPhase('F2'), on: detail.session.status === 'RUNNING' },
                      { key: 'F3', label: `Sesi 3 · Kesaksian · ${Math.round(prefSec('F3') / 60)}’`, run: () => void startWithPrefs('wrapup', 'F3'), on: detail.session.status === 'RUNNING' },
                      { key: 'CLOSING', label: `Konklusi · ${Math.round(prefSec('CLOSING') / 60)}’`, run: () => void monologPhase('CLOSING'), on: detail.session.status === 'WRAPUP' },
                    ] as const
                  ).map((b) => {
                    const active = live?.phase?.name === b.key;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        disabled={busy || !b.on}
                        onClick={b.run}
                        title={active ? 'Fase sedang berjalan' : b.key === 'F1' ? 'Mulai sesi + buka Q1-Q3' : b.key === 'F2' ? 'Buka Q4-Q5 + timer 25 menit' : b.key === 'F3' ? 'Wrapup + undian + chip (10 menit)' : 'Timer transisi 5 menit'}
                        className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 ${active ? 'ring-2 ring-offset-2 ring-brand bg-[#1B1B1B]' : 'bg-emerald-600'}`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                  {renderExtendChips((s) => void extendPhase(s), Boolean(live?.phase?.startedAt))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('close')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-[#1B1B1B]"
                  >
                    Tutup Sesi
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('reset')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-60 bg-white !text-[#8C8880] border border-[#D9D7D0]"
                  >
                    Reset ke Draft
                  </button>
                </>
              ) : isFilm ? (
                <>
                  {(
                    [
                      { key: 'M0', label: 'Buka Likert AWAL · 5’', run: async () => { await doAction('open-likert'); await filmSetRounds('open', 'closed', 'Likert AWAL dibuka (baseline 5 item).'); await saveStage(detail.session.id, { phase: { name: 'M0', startedAt: new Date().toISOString(), durationSec: 300, showOnScreen: true } }); await loadDetail(); }, on: ['DRAFT', 'LIKERT_OPEN'].includes(detail.session.status), title: 'Buka akses + gate ronde AWAL + timer 5 menit (satu-satunya timer film)' },
                      { key: 'M1', label: 'Mulai Film (ikuti film)', run: async () => { await doAction('start'); await filmSetRounds('closed', 'closed', 'Film mulai — Likert AWAL dikunci. Layar mode tenang.'); await saveStage(detail.session.id, { phase: null }); await loadDetail(); }, on: detail.session.status === 'LIKERT_OPEN', title: 'Start sesi + kunci AWAL + matikan timer (mengikuti durasi film)' },
                      { key: 'M3', label: 'Buka Likert AKHIR + Lesson Learned · 5’', run: async () => { await filmSetRounds('closed', 'open', 'Likert AKHIR + Lesson Learned dibuka — delta tampil di layar.'); }, on: detail.session.status === 'RUNNING', title: 'Buka ronde AKHIR + Lesson Learned serentak + tampil delta pre→post' },
                      { key: 'M4', label: 'Undi + Kesaksian · 10’', run: async () => { await doAction('wrapup'); setMsg({ kind: 'ok', text: 'Wrapup: undi 2 via panel Undian — nama + grup + hasil Lesson Learned tampil di layar.' }); }, on: detail.session.status === 'RUNNING', title: 'Wrapup + undi 1 Mentee + 1 Mentor via panel Undian' },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      disabled={busy || !b.on}
                      onClick={() => void b.run()}
                      title={b.title}
                      className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-emerald-600"
                    >
                      {b.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('close')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-[#1B1B1B]"
                  >
                    Tutup Sesi
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('reset')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-60 bg-white !text-[#8C8880] border border-[#D9D7D0]"
                  >
                    Reset ke Draft
                  </button>
                  <span className="text-[11px] font-bold text-[#8C8880]">
                    Gate: AWAL {String(detail.session.config?.likertRounds?.pre || 'open').toUpperCase()} · AKHIR {String(detail.session.config?.likertRounds?.post || 'closed').toUpperCase()}
                  </span>
                </>
              ) : isDebat ? (
                <>
                  {(() => {
                    const atLast = debatRoundCount > 0 && debatCurrent >= debatRoundCount - 1;
                    const buttons = [
                      {
                        key: 'D0',
                        label: `Mulai Ronde 1 · Reveal 1′`,
                        on: ['DRAFT', 'OPEN', 'LIKERT_OPEN'].includes(String(detail.session.status)),
                        title: 'Buka sesi + ronde 1 langkah The Reveal (1 menit)',
                        run: async () => {
                          await doAction('start');
                          await debatStage({ current: 0, phase: 'brief', step: 0, stepStartedAt: new Date().toISOString() }, 'Ronde 1 dimulai — The Reveal 1′.');
                        },
                      },
                      {
                        key: 'D1',
                        label: `Ronde Berikutnya (${Math.min(debatCurrent + 2, Math.max(1, debatRoundCount || debatCurrent + 2))}/${debatRoundCount || '?'})`,
                        on: detail.session.status === 'RUNNING' && debatRoundCount > 0 && !atLast,
                        title: 'Lanjut ke ronde berikutnya (langkah balik ke The Reveal)',
                        run: () => debatStage({ current: debatCurrent + 1, phase: 'brief', step: 0, stepStartedAt: new Date().toISOString() }, `Ronde ${debatCurrent + 2} — The Reveal.`),
                      },
                      {
                        key: 'D2',
                        label: 'Trap Reveal · 20′',
                        on: detail.session.status === 'RUNNING',
                        title: 'Konklusi: bongkar dikotomi palsu (buka wrapup + naskah Trap Reveal)',
                        run: async () => {
                          await doAction('wrapup');
                          await debatStage({ phase: 'selesai' }, 'Trap Reveal dibuka — konklusi 20′.');
                        },
                      },
                    ];
                    return buttons.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        disabled={busy || !b.on}
                        onClick={() => void b.run()}
                        title={b.title}
                        className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-emerald-600"
                      >
                        {b.label}
                      </button>
                    ));
                  })()}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('close')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-[#1B1B1B]"
                  >
                    Tutup Sesi
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doAction('reset')}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-60 bg-white !text-[#8C8880] border border-[#D9D7D0]"
                  >
                    Reset ke Draft
                  </button>
                  <span className="text-[11px] font-bold text-[#8C8880]">
                    Ronde {debatRoundCount ? debatCurrent + 1 : 0}/{debatRoundCount || 0} · langkah {Number(debatRoundsState?.step ?? 0) + 1}/11
                  </span>
                </>
              ) : (
              <>
              {visibleActions.filter((a) => a.action !== 'extend').map((a) => {
                const label = isMonolog && a.action === 'start'
                  ? 'Mulai Bedah Lagu & Monolog'
                  : isMonolog && a.action === 'wrapup'
                    ? 'Buka Lesson Learned'
                    : isCreativeLab && a.action === 'start'
                      ? 'Mulai Sesi'
                      : isCreativeLab && a.action === 'wrapup'
                        ? 'Buka Satu Kata'
                        : a.label;
                return (
                <button
                  key={a.action}
                  type="button"
                  disabled={busy}
                  onClick={() => void doAction(a.action)}
                  className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 ${a.tone}`}
                >
                  {label}
                </button>
                );
              })}
              {visibleActions.some((a) => a.action === 'extend') &&
                renderExtendChips((s) => void doAction('extend', { seconds: s }), true)}
              </>
              )}
              <span className="ml-auto text-[11px] font-bold text-[#8C8880]">
                {isMonolog && live?.phase?.startedAt
                  ? `Fase ${live.phase.name} · sisa ±${Math.max(0, Math.round((new Date(live.phase.startedAt).getTime() + Number(live.phase.durationSec) * 1000 - Date.now()) / 60000))} mnt · `
                  : ''}
                Status: {STATUS_LABELS[detail.session.status]}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] text-[#8C8880]">Timer sesi (detik)</span>
                <input
                  className={INPUT}
                  type="number"
                  min={60}
                  value={configDraft.timerSeconds}
                  onChange={(e) => setConfigDraft((c) => ({ ...c, timerSeconds: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[#8C8880]">Target peserta (opsional)</span>
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={configDraft.expectedCount}
                  placeholder="otomatis dari tenant"
                  onChange={(e) => setConfigDraft((c) => ({ ...c, expectedCount: e.target.value }))}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveConfig()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan konfigurasi
                </button>
              </div>
            </div>

            {isCreativeLab && (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
                  <b>Alur hari-H:</b> Mulai Sesi → <b>Sesi 1</b> (Reminder Jar 15′) → <b>Sesi 2</b> (Art Stations 25′) → <b>Presentasi Kelompok</b> →{' '}
                  <b>Kelompok berikutnya</b> sampai selesai → <b>Buka Satu Kata</b>. Timer aktivitas display-only; transisi manual. Kunci fase tetap A1/A2.
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8C8880]">
                  <span>
                    Timer sesi pola ini <b className="text-[#1B1B1B]">120 menit = 7200 detik</b> (PRA 20′ terpisah; Firman & Briefing 15′; Presentasi Kelompok blok 30′).
                  </span>
                  {Number(configDraft.timerSeconds) !== 7200 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfigDraft((c) => ({ ...c, timerSeconds: 7200 }))}
                      className="px-2.5 py-1 rounded-full border border-[#D9D7D0] font-bold text-[#1B1B1B] hover:border-brand disabled:opacity-60"
                    >
                      Pakai 7200 dtk
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-[#EFEDE8] bg-white p-3 space-y-2">
                  <p className="text-[11px] font-black text-[#1B1B1B]">Briefing di layar · pencatat & pengundian</p>
                  <label className="block text-[11px] text-[#8C8880] space-y-1">
                    <span className="font-bold">Umumkan pencatat</span>
                    <textarea
                      value={briefingDraft.scribe}
                      onChange={(e) => setBriefingDraft((b) => ({ ...b, scribe: e.target.value }))}
                      rows={2}
                      placeholder="Umumkan perwakilan pencatat tiap kelompok."
                      className="w-full px-2.5 py-2 rounded-xl border border-[#D9D7D0] text-xs text-[#1B1B1B]"
                    />
                  </label>
                  <label className="block text-[11px] text-[#8C8880] space-y-1">
                    <span className="font-bold">Umumkan pengundian</span>
                    <textarea
                      value={briefingDraft.draw}
                      onChange={(e) => setBriefingDraft((b) => ({ ...b, draw: e.target.value }))}
                      rows={2}
                      placeholder="Umumkan pengundian urutan presentasi kelompok."
                      className="w-full px-2.5 py-2 rounded-xl border border-[#D9D7D0] text-xs text-[#1B1B1B]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveBriefing()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan pengumuman layar
                  </button>
                </div>
                <ActivityPanel sessionId={detail.session.id} />
              </div>
            )}

            {isMonolog && (
              <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold">Pengaturan tiap fase</p>
                  <span className="text-[10px] text-[#8C8880]">durasi per fase + tampil di layar proyektor</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void savePhasePrefs()}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan fase
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['F1', 'F2', 'F3', 'CLOSING'] as const).map((name) => (
                    <div key={name} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-2.5 space-y-1.5">
                      <p className="text-[11px] font-black">{name}</p>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#8C8880]">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={phasePrefsDraft[name]?.min}
                          onChange={(e) => setPhasePrefsDraft((p) => ({ ...p, [name]: { ...p[name], min: e.target.value } }))}
                          className="w-16 px-2 py-1 rounded-lg border border-[#D9D7D0] text-xs font-bold focus:outline-none focus:border-brand"
                        />
                        mnt
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-[#8C8880] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phasePrefsDraft[name]?.show !== false}
                          onChange={(e) => setPhasePrefsDraft((p) => ({ ...p, [name]: { ...p[name], show: e.target.checked } }))}
                          className="w-3.5 h-3.5 accent-[#181818]"
                        />
                        Tampil di layar
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPostToPost && (
            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Tempat pos per prioritas</p>
                <span className="ml-auto text-[11px] font-bold text-[#8C8880] tabular-nums">
                  Total {venueTotal} kursi
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[0, 1, 2].map((rank) => (
                  <label key={rank} className="space-y-1">
                    <span className="text-[11px] text-[#8C8880]">Rank {rank + 1}</span>
                    <select
                      className={INPUT}
                      value={rankVenues[rank] || ''}
                      disabled={busy}
                      onChange={(e) => setRankVenues((prev) => prev.map((v, i) => (i === rank ? e.target.value : v)))}
                    >
                      <option value="">— Pilih tempat —</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id} disabled={!v.isActive}>
                          {v.name} · {v.capacity}
                          {v.isActive ? '' : ' (nonaktif)'}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveVenues()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" /> Simpan tempat
              </button>
            </div>
            )}

            {isPostToPost && (
            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Daftar tempat &amp; daya tampung</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void loadVenues()}
                  className="ml-auto text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
                >
                  Muat ulang
                </button>
              </div>
              <ul className="space-y-2">
                {venues.map((v) => {
                  const edit = venueEdit[v.id] || { capacity: String(v.capacity), note: v.note || '' };
                  return (
                    <li key={v.id} className={`rounded-xl border p-3 space-y-2 ${v.isActive ? 'border-[#EFEDE8]' : 'border-[#EFEDE8] bg-[#FAF9F5] opacity-70'}`}>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-[#1B1B1B]">{v.name}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] font-bold text-[#8C8880]">{v.kind}</span>
                        {!v.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">Nonaktif</span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void patchVenue(v.id, { isActive: !v.isActive })}
                            className="text-[11px] font-bold text-sky-700 hover:underline"
                          >
                            {v.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteVenue(v.id, v.name)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline disabled:opacity-60"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </span>
                      </div>
                      <div className="grid grid-cols-[96px_1fr] gap-2 items-center">
                        <label className="space-y-1">
                          <span className="text-[10px] text-[#8C8880]">Kapasitas</span>
                          <input
                            className={INPUT}
                            type="number"
                            min={0}
                            value={edit.capacity}
                            disabled={busy}
                            onChange={(e) => setVenueEdit((prev) => ({ ...prev, [v.id]: { ...edit, capacity: e.target.value } }))}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] text-[#8C8880]">Deskripsi detail</span>
                          <input
                            className={INPUT}
                            value={edit.note}
                            disabled={busy}
                            placeholder="cth. antara GMIM dan HKBP"
                            onChange={(e) => setVenueEdit((prev) => ({ ...prev, [v.id]: { ...edit, note: e.target.value } }))}
                          />
                        </label>
                      </div>
                      {(edit.capacity !== String(v.capacity) || (edit.note || '') !== (v.note || '')) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchVenue(v.id, { capacity: Number(edit.capacity) || 0, note: edit.note.trim() || null })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-60"
                        >
                          <Save className="w-3 h-3" /> Simpan
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="space-y-1 col-span-2">
                  <span className="text-[10px] text-[#8C8880]">Nama tempat baru</span>
                  <input
                    className={INPUT}
                    value={venueDraft.name}
                    disabled={busy}
                    placeholder="cth. Teras Belakang"
                    onChange={(e) => setVenueDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[#8C8880]">Kapasitas</span>
                  <input
                    className={INPUT}
                    type="number"
                    min={0}
                    value={venueDraft.capacity}
                    disabled={busy}
                    onChange={(e) => setVenueDraft((d) => ({ ...d, capacity: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[#8C8880]">Jenis</span>
                  <select
                    className={INPUT}
                    value={venueDraft.kind}
                    disabled={busy}
                    onChange={(e) => setVenueDraft((d) => ({ ...d, kind: e.target.value }))}
                  >
                    {['LANTAI', 'TERAS', 'CITYWALK'].map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 col-span-2 sm:col-span-3">
                  <span className="text-[10px] text-[#8C8880]">Deskripsi detail</span>
                  <input
                    className={INPUT}
                    value={venueDraft.note}
                    disabled={busy}
                    placeholder="cth. antara GMIM dan HKBP"
                    onChange={(e) => setVenueDraft((d) => ({ ...d, note: e.target.value }))}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addVenue()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </div>
              </div>
            </div>
            )}

            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Kode sesi proyektor</p>
                <span className="ml-2 font-mono text-sm font-black tracking-[0.2em]">
                  {detail.session.accessCode || '—'}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void rotateCode()}
                  className="ml-auto text-[11px] font-bold text-brand disabled:opacity-60"
                >
                  Rotasi kode
                </button>
              </div>
              {(
                [
                  ['Peserta', links.peserta],
                  ['Layar proyektor', links.layar],
                  ['Control room', links.kontrol],
                ] as const
              ).map(([label, url]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-[#8C8880]">{label}</span>
                  <code className="flex-1 truncate text-[11px] text-[#1B1B1B]">{url}</code>
                  <button
                    type="button"
                    onClick={() => copy(url)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand"
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin
                  </button>
                </div>
              ))}
              <a
                href={`/api/worship/sessions/${detail.session.id}/export.csv`}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand mt-1"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor CSV (Likert + chip)
              </a>
            </div>
          </div>

          <div className={CARD}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <p className="text-sm font-black">Monitor hari-H</p>
              <span className="ml-auto text-xs text-[#8C8880] tabular-nums">
                {live?.progress.submitted ?? detail.progress.submitted}/{live?.progress.total ?? detail.progress.total}{' '}
                sudah mengisi
              </span>
            </div>
            {isPostToPost && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(live?.rooms || detail.rooms).map((room) => (
                <div key={room.code} className="rounded-xl border border-[#EFEDE8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#BDBAB2]">{room.floorLabel}</p>
                  <p className="text-sm font-bold mt-1">{room.label}</p>
                  <p className="text-[11px] text-[#8C8880] mt-1 tabular-nums">
                    {room.count}{(room.capacity || 0) > 0 ? `/${room.capacity}` : ''} peserta
                    {room.isFull ? ' · Penuh' : ''}
                  </p>
                </div>
              ))}
            </div>
            )}
            {canManageChips && (live?.wordcloud || detail.wordcloud).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(live?.wordcloud || detail.wordcloud).map((w) => (
                  <span key={w.code} className="px-3 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold">
                    {w.label} · {w.count}
                  </span>
                ))}
              </div>
            )}

            {(detail.notes || []).length > 0 && (
              <details className="mt-4 rounded-xl border border-[#EFEDE8] p-3">
                <summary className="text-xs font-bold cursor-pointer">
                  Catatan peserta ({new Set((detail.notes || []).map((n) => n.userId)).size} orang)
                </summary>
                <div className="mt-3 space-y-3 max-h-80 overflow-y-auto">
                  {[...new Set((detail.notes || []).map((n) => n.userId))].map((userId) => {
                    const rows = (detail.notes || []).filter((n) => n.userId === userId);
                    return (
                      <div key={userId} className="rounded-xl border border-[#EFEDE8] p-3">
                        <p className="text-xs font-bold">{rows[0]?.userName || userId}</p>
                        {rows.map((n) => (
                          <p key={`${n.userId}-${n.topicCode}`} className="text-[11px] text-[#8C8880] mt-1">
                            <span className="font-bold text-brand">{n.topicCode}</span> — {n.content}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>

          {isPostToPost && (
          <div className={CARD}>
            <p className="text-sm font-black">Pertanyaan Likert ({detail.likertItems.length})</p>
            <div className="mt-3 space-y-2">
              {detail.likertItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#EFEDE8] p-3 flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand">{item.topicCode}</p>
                    <p className="text-xs mt-1">{item.text}</p>
                    {item.gospelNote && <p className="text-[11px] text-[#8C8880] mt-1">{item.gospelNote}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item.id)}
                    className="p-1.5 rounded-lg text-[#8C8880] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
              <select
                className={INPUT}
                value={newItem.topicCode}
                onChange={(e) => setNewItem((n) => ({ ...n, topicCode: e.target.value }))}
              >
                <option value="">Topik…</option>
                {detail.session.config.topics.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                className={INPUT}
                rows={2}
                placeholder="Teks pernyataan (skala 1–5)"
                value={newItem.text}
                onChange={(e) => setNewItem((n) => ({ ...n, text: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy || !newItem.topicCode || !newItem.text.trim()}
                onClick={() => void addItem()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>
          )}

          {canManageChips && (
          <div className={CARD}>
            <p className="text-sm font-black">{isCreativeLab ? 'Satu Kata' : 'Lesson Learned'} ({detail.chips.length})</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.chips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D9D7D0] text-xs font-bold"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => void deleteChip(chip.code)}
                    className="text-[#BDBAB2] hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2">
              <select
                className={INPUT}
                value={newChip.topicCode}
                onChange={(e) => setNewChip((n) => ({ ...n, topicCode: e.target.value }))}
              >
                <option value="">Umum</option>
                {detail.session.config.topics.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className={INPUT}
                placeholder="#KataKunci"
                value={newChip.label}
                onChange={(e) => setNewChip((n) => ({ ...n, label: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy || !newChip.label.trim()}
                onClick={() => void addChip()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>
          )}

          {!isCreativeLab && (
            <TestimonyPanel
              sessionId={detail.session.id}
              mode={isMonolog ? 'monolog' : isFilm ? 'film' : 'standard'}
            />
          )}
          {patternCode === 'DEBAT' && (
            <DebatPanel sessionId={detail.session.id} />
          )}
          {patternCode === 'BEDAH_FILM' && (
            <ScreeningPanel sessionId={detail.session.id} />
          )}
          {patternCode === 'THREE_SEQUENCES' && (
            <TeamsPanel sessionId={detail.session.id} />
          )}
          </fieldset>
        </>
      )}

      {busy && (
        <p className="text-xs text-[#8C8880] inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses…
        </p>
      )}
    </div>
    </div>
  );
};

export default MentoringControl;
