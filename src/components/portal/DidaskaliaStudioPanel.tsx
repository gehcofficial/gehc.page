import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Sparkles,
  Save,
  FileText,
  Download,
  Upload,
  Calendar,
  Link2,
  Copy,
  Wand2,
  RefreshCw,
  Send,
  Presentation,
  BookOpen,
  Users,
  ShieldCheck,
  ExternalLink,
  MessageCircle,
  Settings,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  RITUAL_LABELS,
  RITUAL_TYPES,
  defaultStudio,
  defaultSermon,
  ensurePaths,
  ensureRhbSections,
  formatJakarta,
  hashContent,
  needsRepublish,
  publishFeedback,
  releaseState,
  statusLabel,
  studioHasImportedSource,
  filterCommentsByScope,
  scopeLabel,
  type DidaskaliaComment,
  type DidaskaliaMethodMix,
  type DidaskaliaPendingRegen,
  type DidaskaliaRegenHistory,
  type DidaskaliaPath,
  type DidaskaliaRhbSection,
  type DidaskaliaStudio,
  type RitualType,
} from '../../lib/didaskalia';
import { blobToBase64, buildKhutbahPdf, buildPembekalanPdf, buildRhbPdfs } from '../../lib/didaskaliaPdf';
import { materialHashPath, rememberPortalPlace } from '../../lib/didaskalia-presentation';
import { buildDayCaption, buildWeekCaption, buildPembekalanCaption, buildKhutbahCaption, copyText } from '../../lib/rhb-caption';
import { readFlowBaseline, writeFlowBaseline } from '../../lib/flow-stale';
import { applyWeekPattern, WEEK_PATTERN_CHANGED_EVENT, type WeekPatternChangedDetail } from '../../lib/apply-week-pattern';
const DidaskaliaSumberTab = lazy(() => import('./DidaskaliaSourceImport').then((m) => ({ default: m.DidaskaliaSourceImport })));
const DidaskaliaGambarTab = lazy(() => import('./DidaskaliaGambarPanel').then((m) => ({ default: m.DidaskaliaGambarPanel })));
const DidaskaliaKontenPane = lazy(() => import('./DidaskaliaKontenPane').then((m) => ({ default: m.DidaskaliaKontenPane })));
const DidaskaliaSettingsTab = lazy(() => import('./DidaskaliaKnowledgePanel').then((m) => ({ default: m.DidaskaliaKnowledgePanel })));

type WeekMeta = { index: number; date: string; theme?: string; mentoringTheme?: string; servingTheme?: string; patternCode?: string };
type RitualRow = { type: RitualType; date: string; timeStart: string; timeEnd: string; status: string; notes?: string; meetUrl?: string };

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthOptions() {
  const base = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(base.getFullYear(), base.getMonth() + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { ym, label };
  });
}
function sundaysOfMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m - 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';
const labelCls = 'text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block';

/** Baca JSON dengan aman — server/edge bisa balas non-JSON (mis. halaman error). */
async function readJson(r: Response): Promise<any> {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

async function assetDataUrl(fileId?: string): Promise<string | undefined> {
  if (!fileId) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`/api/didaskalia/asset/${encodeURIComponent(fileId)}`, { credentials: 'include', signal: ctrl.signal });
    if (!r.ok) return undefined;
    const blob = await r.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function collectPdfImages(st: DidaskaliaStudio) {
  const pres = st.presentation || {};
  const rhbDayImages: Record<number, string> = {};
  const rhbAi = pres.rhbAi && typeof pres.rhbAi === 'object' ? pres.rhbAi : {};
  for (const p of ensurePaths(st)) {
    const dayImg = await assetDataUrl(rhbAi[String(p.pathIndex)]);
    if (dayImg) rhbDayImages[p.pathIndex] = dayImg;
  }
  const khutbahSectionImages: Record<string, string> = {};
  const khLit = pres.khutbahLiteral && typeof pres.khutbahLiteral === 'object' ? pres.khutbahLiteral : {};
  for (const key of ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan']) {
    const d = await assetDataUrl(khLit[key]);
    if (d) khutbahSectionImages[key] = d;
  }
  return { coverImage: await assetDataUrl(pres.cover), rhbDayImages, khutbahSectionImages };
}

type StudioTab = 'sumber' | 'konten' | 'diskusi' | 'gambar' | 'terbitkan';

/** Pesan galat AI yang bisa ditindaklanjuti. */
function friendlyAiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : 'AI gagal.';
  if (/terpotong|JSON tidak valid/i.test(msg)) {
    return 'Keluaran AI terpotong — coba lagi, atau kurangi dokumen pengetahuan aktif di menu setelan.';
  }
  return msg;
}

export const DidaskaliaStudioPanel: React.FC<{ yearMonth?: string; weekIndex?: number; eventName?: string; onOpenPola?: () => void }> = ({ yearMonth, weekIndex: weekIndexProp, eventName, onOpenPola }) => {
  const { addToast, authUser, currentUser, currentRole, isKomisi, isBodTimkerja, isDidaskalia } = useApp();
  const canWrite = isKomisi || currentRole === 'SUPERADMIN' || isBodTimkerja || isDidaskalia;

  const [tab, setTab] = useState<StudioTab>('sumber');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jobs, setJobs] = useState<Array<{ id: string; label: string; status: 'running' | 'ok' | 'error' }>>([]);
  const [mountedTabs, setMountedTabs] = useState<Partial<Record<StudioTab, boolean>>>({ sumber: true });
  const [ym, setYm] = useState(yearMonth || currentYearMonth());
  const [weekIndex, setWeekIndex] = useState(weekIndexProp || 1);
  const [coverage, setCoverage] = useState(4);

  // Konteks dari panel divisi: ikuti event terpilih (tanggal dipilih sekali).
  useEffect(() => {
    if (yearMonth && yearMonth !== ym) setYm(yearMonth);
  }, [yearMonth]);
  useEffect(() => {
    if (weekIndexProp && weekIndexProp !== weekIndex) setWeekIndex(weekIndexProp);
  }, [weekIndexProp]);

  const months = useMemo(() => monthOptions().slice(0, coverage), [coverage]);
  const weeksInMonth = useMemo(() => sundaysOfMonth(ym), [ym]);

  const [studio, setStudio] = useState<DidaskaliaStudio>(defaultStudio());
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const dirtyRef = useRef(new Set<string>());
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queueRef = useRef(Promise.resolve());
  const sermonSnap = useRef<string | null>(null);
  const locRef = useRef({ ym, weekIndex });
  locRef.current = { ym, weekIndex };
  const pendingBuildRef = useRef<Record<string, { loc: { ym: string; weekIndex: number }; build: () => Record<string, unknown> }>>({});
  const [weekMeta, setWeekMeta] = useState<WeekMeta | null>(null);
  const [patterns, setPatterns] = useState<import('../../lib/worship-patterns').WorshipPatternLite[]>([]);
  const [event, setEvent] = useState<{ id: string; name: string; serviceType?: string | null; eventDate?: string | null } | null>(null);
  const [links, setLinks] = useState<Array<{ refId: string; label: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [publishNote, setPublishNote] = useState<Record<string, { tone: 'running' | 'ok' | 'warn' | 'error'; title: string; detail?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastAiKind, setLastAiKind] = useState<'draft' | 'sermon' | 'enrich' | null>(null);
  const [comment, setComment] = useState('');
  const [useDiscussionContext, setUseDiscussionContext] = useState(true);
  const [enDraft, setEnDraft] = useState<Record<string, { titleEn: string; summaryEn: string; bigIdeaEn: string }>>({});
  /** Status token Drive pemilik (untuk pra-cek sebelum generate gambar). */
  const [driveAuth, setDriveAuth] = useState<{ checked: boolean; ok: boolean; ownerEmail?: string | null }>({ checked: false, ok: true });
  /** Hasil verifikasi ayat via bolls.life (TB kanonis + KJV/ESV pembanding; tanpa tulis DB). */
  const [bibleCheck, setBibleCheck] = useState<{ loading: boolean; error?: string; checks?: Array<{ ref: string; parsed?: { book?: string; chapter?: number; verseStart?: number; verseEnd?: number }; results?: Array<{ version?: string; text?: string; ablated?: boolean; attribution?: string; error?: string }> }> } | null>(null);

  const checkDriveAuth = useCallback(async () => {
    try {
      const r = await fetch('/api/drive/token-status', { credentials: 'include' });
      const d = r.ok ? await r.json() : null;
      if (!d) return;
      setDriveAuth({ checked: true, ok: !d.authFailed && (d.hasToken === false || d.userOk !== false), ownerEmail: d.ownerEmail || null });
    } catch {
      /* abaikan — generate akan memberi pesan server */
    }
  }, []);

  useEffect(() => { setMountedTabs((m) => (m[tab] ? m : { ...m, [tab]: true })); }, [tab]);
  useEffect(() => { if (tab === 'terbitkan' || tab === 'gambar') void checkDriveAuth(); }, [tab, checkDriveAuth]);

  /** Perbandingan longgar teks DB vs kanonis (abaikan kapital/spasi/tanda baca). */
  const looseSame = (a?: string, b?: string) => {
    const n = (s?: string) => String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/[,"“”‘’.;:!?()]/g, '').replace(/\s+/g, ' ').trim();
    return Boolean(n(a) && n(a) === n(b));
  };

  /** Verifikasi Teks Utama + Jangkar ke bolls.life (TB/KJV/ESV). Koreksi tetap manual. */
  const verifyBibleVerses = useCallback(async () => {
    const utama = String(studio.sermon?.teksUtama?.ref || '').trim();
    const jangkar = String(studio.fundamentalFirman?.ref || '').trim();
    if (!utama && !jangkar) {
      setBibleCheck({ loading: false, error: 'Isi dulu Teks Utama / Fundamental Firman (ref).' });
      return;
    }
    setBibleCheck({ loading: true });
    try {
      const q = new URLSearchParams({ versions: 'TB,KJV,ESV' });
      if (utama) q.set('ref', utama);
      if (jangkar) q.set('ref2', jangkar);
      const r = await fetch(`/api/bible/verify?${q.toString()}`, { credentials: 'include' });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `Server ${r.status}.`);
      setBibleCheck({ loading: false, checks: d.checks || [] });
    } catch (e: unknown) {
      setBibleCheck({ loading: false, error: e instanceof Error ? e.message : 'Gagal verifikasi.' });
    }
  }, [studio.sermon?.teksUtama?.ref, studio.fundamentalFirman?.ref]);
  const paths = useMemo(() => ensurePaths(studio), [studio]);
  const hasSource = useMemo(() => studioHasImportedSource(studio), [studio]);

  const [schedule, setSchedule] = useState<{ weeks: Array<WeekMeta & { rituals: RitualRow[] }>; theme: string } | null>(null);
  const [schedBusy, setSchedBusy] = useState(false);
  const [approval, setApproval] = useState<{ pending: DidaskaliaPendingRegen | null; history: DidaskaliaRegenHistory[]; canApprove: boolean }>({ pending: null, history: [], canApprove: false });
  const [suggest, setSuggest] = useState<Record<string, { label: string; before: string; text: string }>>({});
  const [commentScope, setCommentScope] = useState<string>('GENERAL');
  const [discussFilter, setDiscussFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}`, { credentials: 'include' });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `Gagal memuat studio (server ${r.status}).`);
      const nextStudio = { ...defaultStudio(), ...(d.week?.studio || {}) };
      sermonSnap.current = JSON.stringify(nextStudio.sermon ?? null);
      setStudio(nextStudio);
      setWeekMeta({ index: d.week?.index, date: d.week?.date, theme: d.week?.theme, mentoringTheme: d.week?.mentoringTheme, servingTheme: d.week?.servingTheme, patternCode: d.week?.patternCode || 'MONOLOG' });
      // Tanpa baseline tercatat, anggap alur sejalan pola aktif (hindari banner palsu).
      if (!readFlowBaseline(ym, weekIndex)) writeFlowBaseline(ym, weekIndex, d.week?.patternCode || 'MONOLOG');
      setEvent(d.event || null);
      setLinks(d.links || []);
      fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/approval`, { credentials: 'include' })
        .then((x) => (x.ok ? x.json() : null))
        .then((a) => { if (a) setApproval({ pending: a.pending || null, history: a.history || [], canApprove: Boolean(a.canApprove) }); })
        .catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [ym, weekIndex]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/worship/patterns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { patterns: [] }))
      .then((d) => setPatterns(((d.patterns || []) as import('../../lib/worship-patterns').WorshipPatternLite[]).filter((p) => p.code)))
      .catch(() => setPatterns([]));
  }, []);

  // Simpan pola ibadah pekan ini lewat helper bersama (sama dengan katalog):
  // PATCH + shell sesi kosong tanggal efektif + kabari panel lain. AI generate
  // berikutnya mengikutinya.
  const savePattern = useCallback(async (code: string) => {
    if (!canWrite) return;
    const next = code || 'MONOLOG';
    setWeekMeta((m) => (m ? { ...m, patternCode: next } : m));
    try {
      const out = await applyWeekPattern({
        ym,
        weekIndex,
        patternCode: next,
        event,
        weekDate: weekMeta?.date ?? null,
      });
      if (out.session === 'created') {
        addToast({ type: 'success', title: `Pola pekan: ${next} — draft kosong siap diisi di tab Pola & Sesi` });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan pola.' });
    }
  }, [addToast, canWrite, weekIndex, ym, event, weekMeta?.date]);

  // Pola diubah dari panel lain (katalog Pola & Sesi) → ikut tanpa reload.
  useEffect(() => {
    const onPattern = (e: Event) => {
      const d = (e as CustomEvent<WeekPatternChangedDetail>).detail;
      if (!d || d.ym !== ym || Number(d.weekIndex) !== Number(weekIndex)) return;
      setWeekMeta((m) => (m ? { ...m, patternCode: d.patternCode } : m));
    };
    window.addEventListener(WEEK_PATTERN_CHANGED_EVENT, onPattern);
    return () => window.removeEventListener(WEEK_PATTERN_CHANGED_EVENT, onPattern);
  }, [ym, weekIndex]);

  const loadSchedule = useCallback(async () => {
    try {
      const r = await fetch(`/api/didaskalia/schedule/${ym}`, { credentials: 'include' });
      const d = await readJson(r);
      if (r.ok) {
        setSchedule({ weeks: d.weeks || [], theme: d.theme || '' });
        setLinks(d.links || []);
      }
    } catch { /* abaikan */ }
  }, [ym]);

  useEffect(() => { if (tab === 'terbitkan') void loadSchedule(); }, [tab, loadSchedule]);

  const enqueueSection = useCallback((body: Record<string, unknown>, loc?: { ym: string; weekIndex: number }) => {
    const where = loc || locRef.current;
    const run = queueRef.current.then(async () => {
      if (!canWrite) return false;
      setSaving(true);
      try {
        const r = await fetch(`/api/didaskalia/studio/${where.ym}/${where.weekIndex}/section`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const d = await readJson(r);
        if (!r.ok) throw new Error(d.error || 'Gagal menyimpan bagian.');
        return true;
      } catch (e: unknown) {
        addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan bagian.' });
        return false;
      } finally {
        setSaving(false);
      }
    });
    queueRef.current = run.then(() => undefined, () => undefined);
    return run;
  }, [addToast, canWrite]);

  const scheduleSection = useCallback((key: string, build: () => Record<string, unknown>) => {
    dirtyRef.current.add(key);
    const loc = { ...locRef.current };
    pendingBuildRef.current[key] = { loc, build };
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => {
      const pending = pendingBuildRef.current[key];
      delete pendingBuildRef.current[key];
      if (!pending) return;
      void enqueueSection(pending.build(), pending.loc).finally(() => dirtyRef.current.delete(key));
    }, 700);
  }, [enqueueSection]);

  const flushSections = useCallback(async () => {
    const keys = Object.keys(pendingBuildRef.current);
    for (const key of keys) {
      if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
      const pending = pendingBuildRef.current[key];
      delete pendingBuildRef.current[key];
      if (pending) await enqueueSection(pending.build(), pending.loc).finally(() => dirtyRef.current.delete(key));
    }
    await queueRef.current;
  }, [enqueueSection]);

  const sermonJson = JSON.stringify(studio.sermon ?? null);
  const scheduleRef = useRef(scheduleSection);
  scheduleRef.current = scheduleSection;
  useEffect(() => {
    if (sermonSnap.current === null || sermonSnap.current === sermonJson) {
      sermonSnap.current = sermonJson;
      return;
    }
    sermonSnap.current = sermonJson;
    scheduleRef.current('sermon', () => ({ target: 'sermon', sermon: studioRef.current.sermon }));
  }, [sermonJson]);

  const applyServerStudio = useCallback((incoming: DidaskaliaStudio) => {
    setStudio((prev) => {
      const out: DidaskaliaStudio = { ...defaultStudio(), ...incoming };
      const dirty = dirtyRef.current;
      if ([...dirty].some((k) => k.startsWith('path:'))) out.paths = prev.paths;
      if (dirty.has('sermon') || dirty.has('meta')) out.sermon = prev.sermon;
      if (dirty.has('meta')) {
        out.homileticMethods = prev.homileticMethods;
        out.methodMix = prev.methodMix;
        out.chapterNo = prev.chapterNo;
        out.fundamentalFirman = prev.fundamentalFirman;
      }
      if (dirty.has('sumber')) {
        out.kitabFokus = prev.kitabFokus;
        out.fundamentalFirman = prev.fundamentalFirman;
        out.chapterNo = prev.chapterNo;
        out.sourceMd = prev.sourceMd;
        out.sourceSnapshot = prev.sourceSnapshot;
        out.paths = prev.paths;
        out.sermon = prev.sermon;
      }
      if (dirty.has('discussion')) out.discussion = prev.discussion;
      if (dirty.has('presentation')) out.presentation = prev.presentation;
      sermonSnap.current = JSON.stringify(out.sermon ?? null);
      studioRef.current = out;
      return out;
    });
  }, []);

  const startJob = (id: string, label: string) => {
    setJobs((list) => [...list.filter((j) => j.id !== id), { id, label, status: 'running' as const }]);
  };
  const finishJob = (id: string, status: 'ok' | 'error') => {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, status } : j)));
  };

  const onScripture = (patch: { teksUtama?: string; kitabFokus?: string }) => {
    setStudio((s) => {
      const sermon = {
        ...s.sermon,
        teksUtama: {
          ...(s.sermon?.teksUtama || { ref: '', text: '' }),
          ...(patch.teksUtama !== undefined ? { ref: patch.teksUtama } : {}),
        },
      };
      const fundamental = patch.teksUtama && !String(s.fundamentalFirman?.ref || '').trim()
        ? { ...s.fundamentalFirman, ref: patch.teksUtama }
        : s.fundamentalFirman;
      const next = {
        ...s,
        sermon,
        kitabFokus: patch.kitabFokus ?? s.kitabFokus,
        fundamentalFirman: fundamental,
      };
      sermonSnap.current = JSON.stringify(sermon);
      studioRef.current = next;
      return next;
    });
    scheduleSection('sumber', () => ({
      target: 'sumber',
      sumber: {
        kitabFokus: studioRef.current.kitabFokus,
        teksUtama: studioRef.current.sermon?.teksUtama,
        fundamentalFirman: studioRef.current.fundamentalFirman,
      },
    }));
  };

  const commitSumber = (sumber: Record<string, unknown>) => {
    dirtyRef.current.add('sumber');
    if (sumber.sermon) sermonSnap.current = JSON.stringify(sumber.sermon);
    setStudio((s) => {
      const next = { ...s } as DidaskaliaStudio;
      if (Array.isArray(sumber.paths)) next.paths = sumber.paths as DidaskaliaStudio['paths'];
      if (sumber.sermon && typeof sumber.sermon === 'object') next.sermon = sumber.sermon as DidaskaliaStudio['sermon'];
      if (typeof sumber.kitabFokus === 'string') next.kitabFokus = sumber.kitabFokus;
      if (typeof sumber.chapterNo === 'string') next.chapterNo = sumber.chapterNo;
      if (sumber.sourceMd && typeof sumber.sourceMd === 'object') next.sourceMd = sumber.sourceMd as DidaskaliaStudio['sourceMd'];
      if (sumber.sourceSnapshot && typeof sumber.sourceSnapshot === 'object') next.sourceSnapshot = sumber.sourceSnapshot as DidaskaliaStudio['sourceSnapshot'];
      if (sumber.fundamentalFirman && typeof sumber.fundamentalFirman === 'object') {
        next.fundamentalFirman = { ...s.fundamentalFirman, ...(sumber.fundamentalFirman as DidaskaliaStudio['fundamentalFirman']) };
      }
      studioRef.current = next;
      return next;
    });
    return enqueueSection({ target: 'sumber', sumber }).finally(() => {
      if (!pendingBuildRef.current.sumber) dirtyRef.current.delete('sumber');
    });
  };

  const patchMeta = (patch: { chapterNo?: string; homileticMethods?: string[]; methodMix?: DidaskaliaMethodMix[]; fundamentalFirman?: { ref?: string; text?: string } }) => {
    setStudio((s) => {
      const next = {
        ...s,
        ...(patch.chapterNo !== undefined ? { chapterNo: patch.chapterNo } : {}),
        ...(patch.homileticMethods ? { homileticMethods: patch.homileticMethods } : {}),
        ...(patch.methodMix ? { methodMix: patch.methodMix } : {}),
        ...(patch.fundamentalFirman ? { fundamentalFirman: { ...s.fundamentalFirman, ...patch.fundamentalFirman } } : {}),
      };
      studioRef.current = next;
      return next;
    });
    scheduleSection('meta', () => ({
      target: 'sermon',
      homileticMethods: studioRef.current.homileticMethods,
      methodMix: studioRef.current.methodMix,
      chapterNo: studioRef.current.chapterNo,
      fundamentalFirman: studioRef.current.fundamentalFirman,
    }));
  };

  const patchSermon = (recipe: (sermon: DidaskaliaStudio['sermon']) => DidaskaliaStudio['sermon']) => {
    setStudio((s) => {
      const sermon = recipe({ ...defaultSermon(), ...s.sermon });
      const next = { ...s, sermon };
      studioRef.current = next;
      return next;
    });
  };

  const runAi = useCallback(async (kind: 'draft' | 'sermon' | 'enrich') => {
    if (!canWrite) return;
    await flushSections();
    const jobId = `ai-${kind}`;
    startJob(jobId, kind === 'draft' ? 'Susun dari nol' : kind === 'enrich' ? 'Perkaya' : 'Metode & inti pesan');
    setLastAiKind(kind);
    setError(null);
    try {
      const discussionText = (studio.discussion || [])
        .map((c) => `${c.userName || 'Tim'}${c.role ? ` (${c.role})` : ''}: ${c.text}`)
        .join('\n');
      const notes = [
        comment,
        useDiscussionContext && discussionText ? `Diskusi tim Didaskalia:\n${discussionText}` : '',
      ].filter(Boolean).join('\n\n') || undefined;
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methods: studio.homileticMethods, notes, patternCode: weekMeta?.patternCode }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `AI gagal (server ${r.status}).`);
      let merged: DidaskaliaStudio = { ...defaultStudio(), ...(d.week?.studio || {}) };
      applyServerStudio(merged);
      // Jaring pengaman: lengkapi Bagian A/B bila draf tidak mengisinya.
      if (kind !== 'sermon') {
        const sm = merged.sermon || defaultSermon();
        const missing = !(sm.deliveryPlan || []).length || !(sm.prepChecklist || []).length || !(sm.discussionFlow || []).length;
        if (missing) {
          try {
            const r2 = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/extras`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes, patternCode: weekMeta?.patternCode }),
            });
            const d2 = await readJson(r2);
            if (r2.ok && d2.week?.studio) {
              merged = { ...defaultStudio(), ...d2.week.studio };
              applyServerStudio(merged);
            }
          } catch {
            /* lanjut tanpa extras */
          }
        }
      }
      const meta = d.meta && typeof d.meta === 'object' ? d.meta : null;
      const warns: string[] = [];
      if (meta) {
        if (Array.isArray(meta.failedPaths) && meta.failedPaths.length) {
          warns.push(`Path ${meta.failedPaths.join(', ')} gagal — dipakai versi lama. Ulangi enrich untuk hari itu bila perlu.`);
        }
        if (Array.isArray(meta.truncatedPaths) && meta.truncatedPaths.length) {
          warns.push(`Path ${meta.truncatedPaths.join(', ')} kepotong limit — periksa kelengkapan sebelum approve.`);
        }
        if (Number(meta.notesDropped) > 0) {
          warns.push(`${Number(meta.notesDropped).toLocaleString('id-ID')} karakter catatan terlama dipotong agar muat limit.`);
        }
      }
      addToast({
        type: warns.length ? 'warning' : 'success',
        title: kind === 'draft' ? 'Pengajuan draf dibuat — menunggu persetujuan HOD'
          : kind === 'enrich' ? 'Pengajuan perkaya dibuat — menunggu persetujuan HOD'
            : 'Ringkasan khotbah dibuat',
        description: warns.length ? warns.join(' ') : undefined,
      });
      // Draf/perkaya menyusun alur mengikuti pola aktif — catat baseline-nya.
      if (kind !== 'sermon') writeFlowBaseline(ym, weekIndex, weekMeta?.patternCode || 'MONOLOG');
      finishJob(jobId, 'ok');
    } catch (e: unknown) {
      setError(friendlyAiError(e));
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'AI gagal.' });
      finishJob(jobId, 'error');
    }
  }, [addToast, applyServerStudio, canWrite, comment, flushSections, studio.homileticMethods, studio.discussion, useDiscussionContext, weekIndex, weekMeta, ym]);

  const aiRefine = useCallback(async (fieldLabel: string, current: string, apply: (text: string) => void) => {
    if (!canWrite || !current.trim()) return;
    setBusy(`refine-${fieldLabel}`);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, current, instruction: comment || 'Buat lebih jelas, hangat, dan mudah dipahami pemuda.', context: weekMeta?.theme || '' }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'AI gagal memperbaiki.');
      apply(d.text || current);
      addToast({ type: 'success', title: 'Diusulkan AI — periksa lalu Simpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'AI gagal.' });
    } finally {
      setBusy(null);
    }
  }, [addToast, canWrite, comment, weekIndex, weekMeta, ym]);

  /** Usulan AI per cell — TIDAK langsung menimpa; menunggu "Terapkan". */
  const aiSuggest = useCallback(async (key: string, fieldLabel: string, current: string, scope?: string) => {
    if (!canWrite || !current.trim()) return;
    setBusy(`suggest-${key}`);
    try {
      const scoped = filterCommentsByScope<DidaskaliaComment>(studio.discussion || [], scope)
        .map((c) => `${c.userName || 'Tim'}: ${c.text}`)
        .join('\n');
      const instruction = [comment, scoped].filter(Boolean).join('\n') || 'Buat lebih jelas, hangat, dan mudah dipahami pemuda.';
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, current, instruction, context: weekMeta?.theme || '' }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'AI gagal memperbaiki.');
      setSuggest((s) => ({ ...s, [key]: { label: fieldLabel, before: current, text: d.text || current } }));
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'AI gagal.' });
    } finally {
      setBusy(null);
    }
  }, [addToast, canWrite, comment, studio.discussion, weekIndex, weekMeta, ym]);

  const dismissSuggestion = (key: string) => setSuggest((st) => { const c = { ...st }; delete c[key]; return c; });
  const applySuggestion = (key: string, apply: (t: string) => void) => {
    const s = suggest[key];
    if (!s) return;
    apply(s.text);
    dismissSuggestion(key);
    addToast({ type: 'success', title: 'Usulan diterapkan' });
  };
  const proposeTranslate = async (target: 'path' | 'sermon', pathIndex?: number) => {
    if (!canWrite) return;
    await flushSections();
    const key = target === 'path' ? `path:${pathIndex}` : 'sermon';
    setBusy(`tr-${key}`);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/translate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, pathIndex }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal menerjemahkan.');
      const proposal = d.proposal || {};
      setEnDraft((s) => ({
        ...s,
        [key]: {
          titleEn: String(proposal.titleEn || ''),
          summaryEn: String(proposal.summaryEn || ''),
          bigIdeaEn: String(proposal.bigIdeaEn || ''),
        },
      }));
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menerjemahkan.' });
    } finally {
      setBusy(null);
    }
  };

  const savePathTranslation = async (i: number, pathIndex: number) => {
    const draft = enDraft[`path:${pathIndex}`];
    if (!draft) return;
    setPath(i, { titleEn: draft.titleEn, summaryEn: draft.summaryEn });
    setEnDraft((s) => { const c = { ...s }; delete c[`path:${pathIndex}`]; return c; });
  };

  const saveSermonTranslation = () => {
    const draft = enDraft.sermon;
    if (!draft) return;
    patchSermon((sermon) => ({ ...sermon, bigIdeaEn: draft.bigIdeaEn, summaryEn: draft.summaryEn }));
    setEnDraft((s) => { const c = { ...s }; delete c.sermon; return c; });
  };

  const suggestionBox = (key: string, apply: (t: string) => void) => {
    const s = suggest[key];
    if (!s) return null;
    return (
      <div className="mt-1 rounded-xl border border-sky-200 bg-sky-50 p-2 space-y-1">
        <p className="text-[10px] font-black text-sky-800">Usulan AI · {s.label}</p>
        <p className="text-[10px] text-[#8C8880] line-through max-h-20 overflow-y-auto whitespace-pre-line">{s.before}</p>
        <p className="text-[11px] text-[#1B1B1B] max-h-40 overflow-y-auto whitespace-pre-line">{s.text}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => applySuggestion(key, apply)} className="text-[10px] font-bold text-white bg-sky-600 px-3 py-1 rounded-full">Terapkan</button>
          <button type="button" onClick={() => dismissSuggestion(key)} className="text-[10px] font-bold text-[#8C8880]">Batal</button>
        </div>
      </div>
    );
  };

  /** Setujui/tolak pengajuan regenerate (HOD). */
  const decideRegen = async (action: 'approve' | 'reject') => {
    if (!canWrite) return;
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Alasan penolakan (akan tampil ke pengusul):') || '';
      if (!reason.trim()) return;
    }
    setBusy(`regen-${action}`);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/approval/${action}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal memproses persetujuan.');
      if (d.week?.studio) applyServerStudio({ ...defaultStudio(), ...d.week.studio });
      await load();
      addToast({ type: 'success', title: action === 'approve' ? 'Regenerate disetujui & diterapkan' : 'Pengajuan ditolak' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal.' });
    } finally { setBusy(null); }
  };

  /** Kembalikan ke versi riwayat (undo). */
  const undoRegen = async (historyId: string) => {
    if (!canWrite) return;
    if (!confirm('Kembalikan ke versi ini? Perubahan setelahnya akan digantikan.')) return;
    setBusy('regen-undo');
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/regen-undo`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historyId }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal mengembalikan versi.');
      if (d.week?.studio) applyServerStudio({ ...defaultStudio(), ...d.week.studio });
      await load();
      addToast({ type: 'success', title: 'Dikembalikan ke versi sebelumnya' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal.' });
    } finally { setBusy(null); }
  };

  const setPath = (i: number, patch: Partial<DidaskaliaPath>) => {
    const pathIndex = i + 1;
    setStudio((s) => {
      const next = { ...s, paths: ensurePaths(s).map((p, idx) => (idx === i ? { ...p, ...patch } : p)) };
      studioRef.current = next;
      return next;
    });
    scheduleSection(`path:${pathIndex}`, () => ({ target: 'path', pathIndex, path: ensurePaths(studioRef.current)[i] }));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const data = await blobToBase64(file);
    const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/presentation-image`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimetype: file.type || 'image/jpeg', data }),
    });
    const d = await readJson(r);
    if (!r.ok) throw new Error(d.error || `Gagal unggah gambar (server ${r.status}).`);
    return String(d.fileId || '');
  };

  const setRhbSection = (i: number, key: string, patch: Partial<DidaskaliaRhbSection>) => {
    const pathIndex = i + 1;
    setStudio((s) => {
      const next = {
        ...s,
        paths: ensurePaths(s).map((p, idx) =>
          idx === i
            ? { ...p, rhbSections: ensureRhbSections(p.rhbSections).map((x) => (x.key === key ? { ...x, ...patch } : x)) }
            : p
        ),
      };
      studioRef.current = next;
      return next;
    });
    scheduleSection(`path:${pathIndex}`, () => ({ target: 'path', pathIndex, path: ensurePaths(studioRef.current)[i] }));
  };

  const refreshFlow = async () => {
    if (!canWrite) return;
    const pattern = weekMeta?.patternCode || 'MONOLOG';
    if (!window.confirm(`Segarkan Bagian A/B mengikuti pola ${pattern}? Isi panduan deliver, checklist, dan alur sekarang akan DITIMPA AI.`)) return;
    setBusy('extras-refresh');
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/extras`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternCode: pattern }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `Gagal menyegarkan (server ${r.status}).`);
      if (d.week?.studio) applyServerStudio({ ...defaultStudio(), ...d.week.studio });
      writeFlowBaseline(ym, weekIndex, pattern);
      const n = (d.extras?.discussionFlow || []).length;
      addToast({ type: 'success', title: `Bagian A/B disegarkan mengikuti ${pattern}${n ? ` (${n} langkah alur)` : ''}` });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyegarkan.' });
    } finally {
      setBusy(null);
    }
  };

  const copyCaption = async (doc: 'pembekalan' | 'khutbah' | 'rhb', dayIndex?: number) => {
    const content = {
      weekIndex,
      date: weekMeta?.date || '',
      theme: weekMeta?.theme || weekMeta?.mentoringTheme || weekMeta?.servingTheme || '',
      chapterNo: studio.chapterNo || '',
      fundamentalFirman: studio.fundamentalFirman || { ref: '', text: '' },
      kitabFokus: studio.kitabFokus || '',
      paths,
      sermon: studio.sermon || defaultSermon(),
      images: studio.presentation || {},
    };
    let text: string;
    if (doc === 'pembekalan') text = buildPembekalanCaption({ doc, yearMonth: ym, weekIndex, content });
    else if (doc === 'khutbah') text = buildKhutbahCaption({ doc, yearMonth: ym, weekIndex, content });
    else text = dayIndex
      ? buildDayCaption({ doc, yearMonth: ym, weekIndex, dayIndex, content })
      : buildWeekCaption({ doc: 'rhb', yearMonth: ym, weekIndex, content });
    const ok = await copyText(text);
    addToast({ type: ok ? 'success' : 'error', title: ok ? 'Caption disalin — tempel ke grup' : 'Gagal menyalin caption' });
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    const entry = {
      id: `c-${Date.now()}`,
      text: comment.trim(),
      at: new Date().toISOString(),
      resolved: false,
      userId: authUser?.id || null,
      userName: currentUser?.name || authUser?.name || null,
      role: currentRole || null,
      scope: commentScope,
    };
    const discussion = [...(studio.discussion || []), entry];
    setComment('');
    setStudio((s) => {
      const next = { ...s, discussion };
      studioRef.current = next;
      return next;
    });
    await enqueueSection({ target: 'discussion', discussion });
  };

  const uploadToDrive = async (files: Array<{ filename: string; blob: Blob; pathIndex?: number }>, subfolder: string) => {
    if (!event?.id) throw new Error('Belum ada event ibadah untuk minggu ini. Buat dulu di Ibadah Mingguan.');
    const uploaded: Array<{ name: string; driveFileId: string; pathIndex?: number }> = [];
    for (const f of files) {
      const data = await blobToBase64(f.blob);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      try {
        const r = await fetch(`/api/events/${event.id}/divisions/DIDASKALIA/drive/upload`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({ filename: f.filename, mimetype: 'application/pdf', data, subfolder }),
        });
        const d = await readJson(r);
        if (r.status === 413) throw new Error('PDF terlalu besar untuk unggahan server.');
        if (!r.ok) throw new Error(d.error || `Gagal upload ke Drive (server ${r.status}).`);
        if (!d.file?.id) throw new Error('Drive tidak mengembalikan file.');
        uploaded.push({ name: f.filename, driveFileId: d.file.id, pathIndex: f.pathIndex });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Unggah Drive habis waktu.');
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }
    return uploaded;
  };

  const download = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const uploadCoverFile = async (file: File) => {
    try {
      const fid = await uploadImage(file);
      const presentation = { ...(studioRef.current.presentation || {}), cover: fid, coverStyle: 'UPLOAD' as const };
      setStudio((s) => ({ ...s, presentation }));
      await enqueueSection({ target: 'presentation', presentation });
      addToast({ type: 'success', title: 'Cover terunggah' });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal unggah cover.' });
    }
  };

  const clearCover = () => {
    const presentation = { ...(studioRef.current.presentation || {}), cover: '' };
    setStudio((s) => ({ ...s, presentation }));
    void enqueueSection({ target: 'presentation', presentation });
  };

  const postPublish = async (doc: 'pembekalan' | 'khutbah' | 'rhb', version: number, files: Array<{ name: string; driveFileId: string; pathIndex?: number }>, hash: string, driveFolder: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ doc, version, files, hash, driveFolder }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `Gagal menyimpan rilis (server ${r.status}).`);
      const meta = d.week?.studio?.render?.[doc];
      if (!meta?.snapshot) throw new Error('Server tidak menyimpan snapshot. Halaman materi tidak berubah.');
      return meta as { version?: number; renderedAt?: string };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Menyimpan snapshot habis waktu. Halaman materi tidak berubah.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  const generateDoc = useCallback(async (doc: 'pembekalan' | 'khutbah' | 'rhb', mode: 'download' | 'upload', studioOverride?: DidaskaliaStudio) => {
    if (!weekMeta) {
      const note = { tone: 'error' as const, title: 'Pekan belum termuat', detail: 'Muat ulang studio, lalu klik lagi.' };
      setPublishNote((n) => ({ ...n, [doc]: note }));
      addToast({ type: 'error', title: note.title, description: note.detail });
      return;
    }
    const folder = doc === 'khutbah' ? '02 Ringkasan Khotbah' : doc === 'rhb' ? '03 RHB 7 Hari' : '01 Pembekalan Mentor - Co mentor';
    setPublishNote((n) => ({ ...n, [doc]: { tone: 'running', title: mode === 'download' ? 'Menyusun PDF…' : 'Menyimpan naskah ke halaman materi…' } }));
    try {
      await flushSections();
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Gagal menyimpan draf.';
      setPublishNote((n) => ({ ...n, [doc]: { tone: 'error', title: 'Draf belum tersimpan', detail } }));
      addToast({ type: 'error', title: 'Draf belum tersimpan', description: detail });
      return;
    }
    const st = studioOverride || studioRef.current;
    if (mode === 'upload' && st.sourceSignoff?.status === 'PENDING') {
      if (!window.confirm('Naskah sumber belum disetujui HOD. Hasil impor tetap bisa diterbitkan. Lanjutkan?')) {
        setPublishNote((n) => { const next = { ...n }; delete next[doc]; return next; });
        return;
      }
    }
    const patternCode = weekMeta.patternCode || 'MONOLOG';
    const patternName = patterns.find((p) => String(p.code || '').toUpperCase() === patternCode)?.name || null;
    const version = (st.render?.[doc]?.version || 0) + 1;
    const hash = doc === 'khutbah'
      ? hashContent({ fundamentalFirman: st.fundamentalFirman, kitabFokus: st.kitabFokus, sermon: st.sermon })
      : hashContent({ chapterNo: st.chapterNo, fundamentalFirman: st.fundamentalFirman, kitabFokus: st.kitabFokus, paths: st.paths });
    setBusy(`pdf-${doc}`);
    let snapshotSaved = false;
    try {
      if (mode === 'upload') {
        const meta = await postPublish(doc, version, st.render?.[doc]?.files || [], hash, folder);
        snapshotSaved = true;
        const saved = publishFeedback({ saved: true, version: Number(meta.version) || version });
        setPublishNote((n) => ({ ...n, [doc]: { tone: 'ok', title: saved.title, detail: 'Menyusun PDF…' } }));
      }
      const opts = { version, serviceType: event?.serviceType || null, patternCode, patternName, ...(await collectPdfImages(st)) };
      const week = { index: weekMeta.index, date: weekMeta.date, mentoringTheme: weekMeta.mentoringTheme, servingTheme: weekMeta.servingTheme, theme: weekMeta.theme, studio: st };
      const built = doc === 'pembekalan'
        ? [buildPembekalanPdf(week, st, opts)]
        : doc === 'khutbah'
          ? [buildKhutbahPdf(week, st, opts)]
          : buildRhbPdfs(week, st, opts);
      if (!built.length) throw new Error('7 Path belum ada.');
      if (mode === 'download') {
        built.forEach((d) => download(d.filename, d.blob));
        setPublishNote((n) => ({ ...n, [doc]: { tone: 'ok', title: 'PDF diunduh', detail: 'Unduh tidak mengubah halaman materi.' } }));
        addToast({ type: 'success', title: 'PDF diunduh', description: 'Halaman materi tidak berubah.' });
        return;
      }
      let driveError = '';
      try {
        const uploaded = await uploadToDrive(built.map((d) => ({ filename: d.filename, blob: d.blob, pathIndex: (d as { pathIndex?: number }).pathIndex })), folder);
        await postPublish(doc, version, uploaded, hash, folder);
      } catch (e) {
        driveError = e instanceof Error ? e.message : 'Gagal unggah Drive.';
      }
      await load();
      const feedback = publishFeedback({ saved: true, driveError, version });
      setPublishNote((n) => ({ ...n, [doc]: { tone: feedback.tone === 'ok' ? 'ok' : 'warn', title: feedback.title, detail: feedback.detail } }));
      addToast({ type: feedback.tone === 'ok' ? 'success' : 'warning', title: feedback.title, description: feedback.detail });
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : 'Gagal generate PDF.';
      const feedback = publishFeedback({ saved: snapshotSaved, driveError: detail, version: snapshotSaved ? version : null });
      setPublishNote((n) => ({ ...n, [doc]: { tone: feedback.tone === 'error' ? 'error' : 'warn', title: feedback.title, detail: feedback.detail } }));
      addToast({ type: feedback.tone === 'error' ? 'error' : 'warning', title: feedback.title, description: feedback.detail });
    } finally {
      setBusy(null);
    }
  }, [addToast, event?.id, event?.serviceType, flushSections, load, patterns, weekIndex, weekMeta, ym]);

  const generateSchedule = async () => {
    setSchedBusy(true);
    try {
      const r = await fetch(`/api/didaskalia/schedule/${ym}/generate`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal generate jadwal.');
      await loadSchedule();
      addToast({ type: 'success', title: 'Jadwal ritual dibuat' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal generate jadwal.' });
    } finally {
      setSchedBusy(false);
    }
  };

  const saveLinks = async () => {
    setSchedBusy(true);
    try {
      const r = await fetch('/api/didaskalia/ritual-links', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links }) });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal simpan link.');
      setLinks(d.links || []);
      addToast({ type: 'success', title: 'Link Meet tersimpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal simpan link.' });
    } finally {
      setSchedBusy(false);
    }
  };

  const approveSource = async () => {
    if (!canWrite) return;
    startJob('source-approve', 'Persetujuan HOD');
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/source-signoff`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || 'Gagal menyetujui naskah.');
      if (d.week?.studio) applyServerStudio({ ...defaultStudio(), ...d.week.studio });
      addToast({ type: 'success', title: 'Naskah sumber disetujui' });
      finishJob('source-approve', 'ok');
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyetujui.' });
      finishJob('source-approve', 'error');
    }
  };

  const pdfButton = (doc: 'pembekalan' | 'khutbah' | 'rhb', label: string, icon: React.ReactNode) => {
    const state = releaseState(studio, doc);
    const action = state === 'stale' ? 'Rilis ulang' : state === 'unreleased' ? 'Terbitkan' : 'Rilis ulang';
    const note = publishNote[doc];
    return (
      <div className="rounded-xl border border-[#E7E5DE] p-2 space-y-1.5 min-w-[220px]">
        <div className="flex items-stretch gap-1.5">
          <button type="button" disabled={busy === `pdf-${doc}`} onClick={() => void generateDoc(doc, 'upload')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-bold disabled:opacity-50">
            {busy === `pdf-${doc}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}{action} {label}
          </button>
          <button type="button" title="Unduh saja, tidak mengubah halaman materi" disabled={busy === `pdf-${doc}`} onClick={() => void generateDoc(doc, 'download')} className="px-2.5 rounded-xl border border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B] disabled:opacity-50"><Download className="w-3.5 h-3.5" /></button>
        </div>
        <p className={`text-[10px] font-bold ${state === 'current' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {state === 'current' ? 'Sama dengan rilis' : state === 'stale' ? 'Draf berbeda dari rilis' : 'Belum dirilis'}
        </p>
        {note && (
          <p className={`text-[10px] ${note.tone === 'error' ? 'text-red-700' : note.tone === 'warn' ? 'text-amber-800' : 'text-[#1B1B1B]'}`}>
            <b>{note.title}</b>{note.detail ? ` — ${note.detail}` : ''}
          </p>
        )}
      </div>
    );
  };

  const studioTabs: Array<{ id: StudioTab; label: string }> = [
    { id: 'sumber', label: 'Sumber' },
    { id: 'konten', label: 'Konten' },
    { id: 'diskusi', label: 'Diskusi' },
    { id: 'gambar', label: 'Gambar' },
    { id: 'terbitkan', label: 'Terbitkan' },
  ];
  const sumberOn = hasSource;
  const disetujuiOn = studio.sourceSignoff?.status === 'APPROVED' || studio.status === 'APPROVED' || studio.status === 'PUBLISHED';
  const terbitOn = Boolean(studio.render?.pembekalan || studio.render?.khutbah || studio.render?.rhb);
  const tabFallback = <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Studio Didaskalia</h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sumberOn ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>Sumber</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${disetujuiOn ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>Disetujui</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${terbitOn ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>Terbit</span>
          <span className="text-[10px] text-[#8C8880]">{saving ? 'Menyimpan…' : 'Tersimpan'}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {studioTabs.map((s) => (
              <button key={s.id} type="button" onClick={() => setTab(s.id)} className={`text-[11px] px-3 py-1.5 rounded-full font-bold border ${tab === s.id ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>{s.label}</button>
            ))}
            <button type="button" onClick={() => { setSettingsOpen(true); setMountedTabs((m) => ({ ...m })); }} title="Pengetahuan dan instruksi AI" className="p-1.5 rounded-full border border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {jobs.some((j) => j.status === 'running' || j.status === 'error') && (
          <div className="flex flex-wrap gap-1.5">
            {jobs.filter((j) => j.status === 'running' || j.status === 'error').slice(-4).map((j) => (
              <span key={j.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${j.status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-sky-50 border-sky-200 text-sky-800'}`}>
                {j.status === 'running' ? 'Berjalan' : 'Gagal'} · {j.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          {yearMonth ? (
            <div className="text-[11px] text-[#8C8880] inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                Event: {event?.name || eventName || 'terpilih'}
                {weekMeta?.date ? ` · ${fmtDate(String(weekMeta.date).slice(0, 10))}` : ''}
              </span>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Bulan</label>
                <select value={ym} onChange={(e) => { setYm(e.target.value); setWeekIndex(1); }} className={inputCls}>
                  {months.map((m) => <option key={m.ym} value={m.ym}>{m.label}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => setCoverage((c) => (c >= 6 ? 4 : c + 2))} className="text-[10px] px-2 py-2 rounded-xl border border-[#D9D7D0] font-bold text-[#8C8880]">+ bulan</button>
              <div>
                <label className={labelCls}>Minggu</label>
                <select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))} className={inputCls}>
                  {weeksInMonth.map((d, i) => <option key={d} value={i + 1}>W{i + 1} · {fmtDate(d)}</option>)}
                </select>
              </div>
              <div className="text-[11px] text-[#8C8880]">
                {event ? <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Event: {event.name}</span> : <span className="text-amber-600">Belum ada event ibadah minggu ini</span>}
              </div>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void flushSections()} disabled={!canWrite || saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan sekarang
            </button>
          </div>
        </div>
        {!canWrite && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mode baca — hanya Komisi/Tim Kerja/Didaskalia yang dapat mengubah.</p>}
        {error && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            {lastAiKind && canWrite && (
              <button type="button" onClick={() => void runAi(lastAiKind)} disabled={jobs.some((j) => j.id === `ai-${lastAiKind}` && j.status === 'running')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
                <RefreshCw className="w-3.5 h-3.5" /> Coba lagi
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat studio…</p>
      ) : (
        <>
          {mountedTabs.sumber && (
            <div hidden={tab !== 'sumber'} className="space-y-3">
              <Suspense fallback={tabFallback}>
                <DidaskaliaSumberTab
                  canWrite={canWrite}
                  ym={ym}
                  weekIndex={weekIndex}
                  studio={studio}
                  busy={busy}
                  setBusy={setBusy}
                  onScripture={onScripture}
                  commitSumber={commitSumber}
                  onStudio={applyServerStudio}
                  downloadPembekalan={(st) => generateDoc('pembekalan', 'download', st)}
                  addToast={addToast}
                />
              </Suspense>
              {!hasSource && (
                <button type="button" disabled={!canWrite || jobs.some((j) => j.id === 'ai-draft' && j.status === 'running')} onClick={() => void runAi('draft')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880] disabled:opacity-50">
                  <Sparkles className="w-3.5 h-3.5" /> Susun dari nol
                </button>
              )}
            </div>
          )}
          {mountedTabs.konten && (
            <div hidden={tab !== 'konten'}>
              <Suspense fallback={tabFallback}>
                <DidaskaliaKontenPane
                  canWrite={canWrite}
                  busy={busy}
                  studio={studio}
                  paths={paths}
                  ym={ym}
                  weekIndex={weekIndex}
                  patternCode={weekMeta?.patternCode || 'MONOLOG'}
                  serviceType={event?.serviceType}
                  enDraft={enDraft}
                  setEnDraft={setEnDraft}
                  bibleCheck={bibleCheck}
                  suggest={suggest}
                  setPath={setPath}
                  setRhbSection={setRhbSection}
                  patchSermon={patchSermon}
                  patchMeta={patchMeta}
                  onNote={(pathIndex) => { setCommentScope(`PATH:${pathIndex}`); setDiscussFilter('ALL'); setTab('diskusi'); }}
                  proposeTranslate={proposeTranslate}
                  savePathTranslation={savePathTranslation}
                  saveSermonTranslation={saveSermonTranslation}
                  aiSuggest={aiSuggest}
                  applySuggestion={applySuggestion}
                  dismissSuggestion={dismissSuggestion}
                  verifyBibleVerses={() => { void verifyBibleVerses(); }}
                  looseSame={looseSame}
                  refreshFlow={() => { void refreshFlow(); }}
                  runSermon={() => { void runAi('sermon'); }}
                  addToast={addToast}
                />
              </Suspense>
            </div>
          )}
          {mountedTabs.diskusi && (
            <div hidden={tab !== 'diskusi'} id="didaskalia-discussion" className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Diskusi</h4><span className="ml-auto text-[10px] text-[#8C8880]">bagian: <b>{scopeLabel(commentScope)}</b></span></div>
              <div className="flex flex-wrap gap-1.5">
                {['ALL', 'GENERAL', 'INTI', 'SERMON'].map((v) => (
                  <button key={v} type="button" onClick={() => setDiscussFilter(v)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${discussFilter === v ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>
                    {v === 'ALL' ? 'Semua' : scopeLabel(v)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {(studio.discussion || []).filter((c) => discussFilter === 'ALL' || (c.scope || 'GENERAL') === discussFilter).map((c) => (
                  <div key={c.id} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
                    <p className="text-[10px] font-bold text-[#1B1B1B]">
                      {c.userName || 'Tim'}
                      {c.role ? <span className="text-[#8C8880] font-normal"> · {c.role}</span> : null}
                      <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5">{scopeLabel(c.scope)}</span>
                    </p>
                    <p className="text-xs text-[#1B1B1B] whitespace-pre-wrap mt-0.5">{c.text}</p>
                    <p className="text-[10px] text-[#8C8880] mt-1">{new Date(c.at).toLocaleString('id-ID')}</p>
                  </div>
                ))}
                {(studio.discussion || []).length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum ada catatan diskusi.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={commentScope} onChange={(e) => setCommentScope(e.target.value)} className={`${inputCls} w-auto`}>
                  <option value="GENERAL">Bagian: Umum</option>
                  <option value="INTI">Bagian: Inti Pesan</option>
                  <option value="SERMON">Bagian: Ringkasan Khotbah</option>
                  {paths.map((row) => <option key={row.pathIndex} value={`PATH:${row.pathIndex}`}>Bagian: Path {row.pathIndex} · {row.dayLabel}</option>)}
                </select>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Catatan rekan tim…" className={inputCls} />
                <button type="button" onClick={() => void addComment()} disabled={!canWrite || !comment.trim()} className="px-3 rounded-xl bg-[#1B1B1B] text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EFEDE8]">
                <button type="button" disabled={!canWrite || jobs.some((j) => j.id === 'ai-enrich' && j.status === 'running')} onClick={() => void runAi('enrich')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
                  <Wand2 className="w-3.5 h-3.5" /> Perkaya
                </button>
                <span className="text-[10px] font-bold text-[#8C8880]">Opsional · kapan saja · bukan syarat terbit</span>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8C8880]">
                  <input type="checkbox" checked={useDiscussionContext} onChange={(e) => setUseDiscussionContext(e.target.checked)} className="w-3.5 h-3.5 rounded border-[#D9D7D0]" />
                  Pakai diskusi ini sebagai konteks
                </label>
                {(studio.generation || 0) > 0 && (
                  <span className="text-[10px] font-bold text-[#8C8880]">Generasi ke-{studio.generation}</span>
                )}
              </div>
            </div>
          )}
          {mountedTabs.gambar && (
            <div hidden={tab !== 'gambar'}>
              <Suspense fallback={tabFallback}>
                <DidaskaliaGambarTab
                  canWrite={canWrite}
                  ym={ym}
                  weekIndex={weekIndex}
                  studio={studio}
                  driveChecked={driveAuth.checked}
                  driveOk={driveAuth.ok}
                  onStudio={applyServerStudio}
                  onDriveFail={() => { setDriveAuth((s) => ({ ...s, checked: true, ok: false })); void checkDriveAuth(); }}
                  uploadCover={uploadCoverFile}
                  clearCover={clearCover}
                  addToast={addToast}
                />
              </Suspense>
            </div>
          )}
          {mountedTabs.terbitkan && (
            <div hidden={tab !== 'terbitkan'} className="space-y-3">
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Persetujuan naskah sumber</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${studio.sourceSignoff?.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : studio.sourceSignoff?.status === 'PENDING' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-[#D9D7D0] text-[#8C8880]'}`}>
                {studio.sourceSignoff?.status === 'APPROVED' ? 'Disetujui' : studio.sourceSignoff?.status === 'PENDING' ? 'Menunggu HOD' : 'Belum diajukan'}
              </span>
            </div>
            <p className="text-[11px] text-[#8C8880]">Persetujuan ini mencatat bahwa HOD sudah meninjau naskah impor. Pekan tetap bisa terbit sebelum disetujui. Perkaya bukan syarat.</p>
            {studio.sourceSignoff?.status === 'APPROVED' && studio.sourceSignoff?.decidedByName && (
              <p className="text-[11px] text-emerald-800">Disetujui {studio.sourceSignoff.decidedByName}</p>
            )}
            {approval.canApprove && hasSource && studio.sourceSignoff?.status !== 'APPROVED' && (
              <button type="button" onClick={() => void approveSource()} disabled={jobs.some((j) => j.id === 'source-approve' && j.status === 'running')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Setujui HOD</button>
            )}
            {!approval.canApprove && <p className="text-[11px] text-[#8C8880]">Hanya kepala divisi Didaskalia atau superadmin yang menyetujui.</p>}
          </div>
          {/* Persetujuan HOD & riwayat regenerate */}
          {(approval.pending || (approval.history || []).length > 0) && (
            <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" />
                <h4 className="text-sm font-black text-[#1B1B1B]">Persetujuan Regenerate & Riwayat</h4>
                {(approval.history || []).length > 0 && <span className="ml-auto text-[10px] text-[#8C8880]">{approval.history.length} versi</span>}
              </div>
              {approval.pending?.status === 'PENDING' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-900">
                    Menunggu persetujuan HOD · {approval.pending.kind === 'enrich' ? 'Perkaya' : 'Draf'} oleh {approval.pending.requestedByName || 'Tim'}
                  </p>
                  <p className="text-[11px] text-amber-800">{approval.pending.summary}</p>
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {(approval.pending.diff || []).map((d, i) => (
                      <div key={i} className="rounded-lg bg-white/80 p-2">
                        <p className="text-[10px] font-black text-[#1B1B1B]">{scopeLabel(d.section)} · {d.label}</p>
                        <p className="text-[10px] text-[#8C8880] line-through">{d.before || '(kosong)'}</p>
                        <p className="text-[10px] text-[#1B1B1B]">{d.after || '(kosong)'}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#8C8880]">Total {(approval.pending.diff || []).length} perubahan.</p>
                  {approval.canApprove ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void decideRegen('approve')} disabled={!!busy} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Setujui & terapkan</button>
                      <button type="button" onClick={() => void decideRegen('reject')} disabled={!!busy} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880]">Tolak…</button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800">Hanya kepala divisi Didaskalia / SUPERADMIN yang dapat menyetujui.</p>
                  )}
                </div>
              ) : approval.pending?.status === 'REJECTED' ? (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  Pengajuan terakhir ditolak{approval.pending.reason ? `: ${approval.pending.reason}` : '.'} — silakan revisi & ajukan ulang.
                </p>
              ) : null}
              {(approval.history || []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#8C8880]">Riwayat versi</p>
                  {approval.history.slice(0, 6).map((h) => (
                    <div key={h.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-bold text-[#1B1B1B]">{new Date(h.at).toLocaleString('id-ID')}</span>
                      <span className="text-[#8C8880]">{h.kind} · {h.applied ? 'diterapkan' : 'ditolak'} · {h.byName || '-'}</span>
                      {canWrite && h.kind !== 'undo' && (
                        <button type="button" onClick={() => void undoRegen(h.id)} className="ml-auto text-[10px] font-bold text-sky-700">Kembalikan</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#8C8880]">
                Pola ibadah pekan ini
                <select
                  value={weekMeta?.patternCode || 'MONOLOG'}
                  disabled={!canWrite}
                  onChange={(e) => void savePattern(e.target.value)}
                  className="rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-xs font-bold text-[#1B1B1B] focus:outline-none focus:border-black disabled:opacity-50"
                >
                  {[{ code: 'MONOLOG', name: 'Monologue & Dialogue' }, ...patterns.filter((pt) => pt.code !== 'MONOLOG' && (pt as { status?: string }).status !== 'ARCHIVED')].map((pt) => (
                    <option key={pt.code} value={pt.code}>{pt.name}</option>
                  ))}
                  {weekMeta?.patternCode && weekMeta.patternCode !== 'MONOLOG' && !patterns.some((pt) => pt.code === weekMeta.patternCode) && (
                    <option value={weekMeta.patternCode}>{weekMeta.patternCode}</option>
                  )}
                </select>
              </label>
              <button type="button" onClick={() => onOpenPola?.()} className="text-[11px] font-bold text-sky-700 hover:underline">Lihat detail pola</button>
            </div>
          </div>
          {/* Generate PDF */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Terbitkan Dokumen</h4></div>
            <div className="flex flex-wrap gap-3">
              {pdfButton('pembekalan', 'Modul Pembekalan (01)', <Upload className="w-3.5 h-3.5" />)}
              {pdfButton('khutbah', 'Ringkasan Khotbah (02)', <Upload className="w-3.5 h-3.5" />)}
              {pdfButton('rhb', 'RHB 7 Hari (03)', <Upload className="w-3.5 h-3.5" />)}
            </div>
            <p className="text-[11px] text-[#8C8880]">Tombol biru menyimpan snapshot ke halaman materi dulu, lalu mengunggah PDF ke Drive. Bila Drive gagal, halaman tetap memakai naskah yang baru disimpan dan pesannya tetap di kartu ini. Ikon unduh tidak mengubah halaman. RHB menghasilkan 7 file.</p>
            {(Object.entries(studio.render || {}) as Array<[string, import('../../lib/didaskalia').DidaskaliaRenderMeta | undefined]>).map(([doc, meta]) => meta && (
              <p key={doc} className="text-[11px] text-[#8C8880]">
                <span className="font-bold text-[#1B1B1B] uppercase">{doc}</span> v{meta.version} · {meta.files?.length || 0} file · terakhir dirilis {formatJakarta(meta.renderedAt)}
                {needsRepublish(studio, doc as 'pembekalan' | 'khutbah' | 'rhb') ? <span className="text-amber-700 font-bold"> · draf lebih baru</span> : <span className="text-emerald-700 font-bold"> · sama dengan draf</span>}
              </p>
            ))}
          </div>
          {/* Presentasi Web + Caption */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Presentation className="w-4 h-4 text-[#0EA5E9]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Presentasi Web &amp; Caption</h4>
            </div>
            <p className="text-[11px] text-[#8C8880]">
              Halaman materi membaca naskah studio. Snapshot rilis yang kosong tidak menyembunyikan outline yang sudah terisi. Rilis ulang menyalin naskah itu ke snapshot.
            </p>
            <p className="text-[11px] text-[#8C8880]">Gambar cover, bagian khotbah, dan hari RHB ada di tab <button type="button" onClick={() => setTab('gambar')} className="font-bold text-sky-700">Gambar</button>. Unduh PDF memakai naskah yang tersimpan. Bila naskah sumber masih menunggu HOD, unggah ke Drive minta konfirmasi — pekan lama tanpa pengajuan tetap langsung terbit.</p>
            <div className="flex flex-wrap gap-2">
              <a href={materialHashPath({ doc: 'pembekalan', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" onClick={() => rememberPortalPlace()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
                <ExternalLink className="w-3.5 h-3.5" /> Pembekalan
              </a>
              <a href={materialHashPath({ doc: 'khutbah', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" onClick={() => rememberPortalPlace()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
                <ExternalLink className="w-3.5 h-3.5" /> Khutbah
              </a>
              <a href={materialHashPath({ doc: 'rhb', yearMonth: ym, weekIndex })} target="_blank" rel="noreferrer" onClick={() => rememberPortalPlace()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <ExternalLink className="w-3.5 h-3.5" /> RHB (indeks 7 hari)
              </a>
              <button type="button" onClick={() => void copyCaption('rhb')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                <MessageCircle className="w-3.5 h-3.5" /> Caption RHB sepekan
              </button>
              <button type="button" onClick={() => void copyCaption('pembekalan')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">
                <MessageCircle className="w-3.5 h-3.5" /> Caption Pembekalan
              </button>
              <button type="button" onClick={() => void copyCaption('khutbah')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold">
                <MessageCircle className="w-3.5 h-3.5" /> Caption Khotbah
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {paths.map((p) => (
                <button
                  key={p.pathIndex}
                  type="button"
                  onClick={() => void copyCaption('rhb', p.pathIndex)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-[#D9D7D0] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
                  title={`Salin caption RHB ${p.dayLabel}`}
                >
                  Caption {p.dayLabel}
                </button>
              ))}
            </div>
          </div>
          {/* Jadwal */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0EA5E9]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Jadwal Ritual Mingguan</h4>
              <button type="button" disabled={!canWrite || schedBusy} onClick={() => void generateSchedule()} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
                {schedBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Generate dari rencana bulan
              </button>
            </div>
            <p className="text-[11px] text-[#8C8880]">Pola: Internal Sync (Senin/Selasa), Serving Group Briefing + Pembinaan Pembaca Firman (Rabu/Kamis, hanya minggu Serving), General Equipping (Jumat/Sabtu).</p>
            <div className="space-y-2">
              {(schedule?.weeks || []).map((wk) => (
                <div key={wk.index} className="rounded-xl border border-[#EFEDE8] p-3">
                  <p className="text-xs font-black text-[#1B1B1B]">W{wk.index} · {fmtDate(wk.date)} {wk.theme ? `· ${wk.theme}` : ''}</p>
                  <div className="mt-2 space-y-1.5">
                    {(wk.rituals || []).length === 0 && <p className="text-[11px] text-[#8C8880] italic">Belum di-generate.</p>}
                    {(wk.rituals || []).map((r) => (
                      <div key={r.type} className="flex flex-wrap items-center gap-2 text-[11px] bg-[#FAF9F5] rounded-lg px-2.5 py-1.5">
                        <span className="font-bold text-[#1B1B1B]">{RITUAL_LABELS[r.type as RitualType] || r.type}</span>
                        <span className="text-[#8C8880]">{fmtDate(r.date)} · {r.timeStart}–{r.timeEnd} WIB</span>
                        {r.meetUrl ? (
                          <>
                            <a href={r.meetUrl} target="_blank" rel="noreferrer" className="font-bold text-sky-700">Join Meet</a>
                            <button type="button" onClick={() => { navigator.clipboard?.writeText(r.meetUrl || ''); addToast({ type: 'success', title: 'Link Meet disalin' }); }} className="inline-flex items-center gap-1 text-[#8C8880]"><Copy className="w-3 h-3" /> Salin</button>
                          </>
                        ) : <span className="text-amber-600">Link Meet belum diatur</span>}
                        <a href={`/api/didaskalia/ritual/${ym}/${wk.index}/${r.type}/ics`} className="ml-auto font-bold text-[#8C8880] hover:text-[#1B1B1B]">.ics</a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!schedule?.weeks?.length && <p className="text-[11px] text-[#8C8880] italic">Belum ada jadwal. Klik Generate.</p>}
            </div>
          </div>

          {/* Link Meet tetap */}
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
            <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-[#0EA5E9]" /><h4 className="text-sm font-black text-[#1B1B1B]">Link Google Meet Tetap</h4></div>
            <div className="grid sm:grid-cols-3 gap-3">
              {RITUAL_TYPES.map((t) => {
                const refId = { INTERNAL_SYNC: 'SYNC', SERVING_BRIEFING: 'SERVING', GENERAL_EQUIPPING: 'EQUIP' }[t];
                const row = links.find((l) => l.refId === refId) || { refId, label: RITUAL_LABELS[t], url: '' };
                return (
                  <div key={refId}>
                    <label className={labelCls}>{RITUAL_LABELS[t]}</label>
                    <input value={row.url} onChange={(e) => setLinks((ls) => {
                      const others = ls.filter((l) => l.refId !== refId);
                      return [...others, { refId, label: RITUAL_LABELS[t], url: e.target.value }];
                    })} placeholder="https://meet.google.com/…" className={inputCls} />
                  </div>
                );
              })}
            </div>
            <button type="button" disabled={!canWrite || schedBusy} onClick={() => void saveLinks()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">Simpan link</button>
          </div>
            </div>
          )}
        </>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" onClick={() => setSettingsOpen(false)}>
          <div className="max-w-3xl mx-auto bg-[#FAF9F5] rounded-2xl p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-[#8C8880]" />
              <h4 className="text-sm font-black text-[#1B1B1B]">Pengetahuan &amp; instruksi AI</h4>
              <button type="button" onClick={() => setSettingsOpen(false)} className="ml-auto text-xs font-bold text-[#8C8880]">Tutup</button>
            </div>
            <Suspense fallback={tabFallback}>
              <DidaskaliaSettingsTab canWrite={canWrite} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};
