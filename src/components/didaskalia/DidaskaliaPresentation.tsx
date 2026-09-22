/**
 * DidaskaliaPresentation — halaman presentasi materi (#/materi/<doc>/<ym>/<pekan>[/<hari>]).
 * Standalone (di luar shell portal), wajib login, RBAC 01/02 mentor+staf, 03 beyonders+staf.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, BookOpen, Check, Copy, Loader2, MessageCircle, Printer, Share2 } from 'lucide-react';
import { DeckShell } from '../presentation/DeckShell';
import {
  MATERIAL_DOC_LABEL,
  buildDeck,
  contentFromStudio,
  docAccess,
  materialAbsoluteUrl,
  materialHashPath,
  parseMaterialHash,
  rhbDayList,
  type DeckSlide,
  type MaterialDoc,
  type ParsedMaterialHash,
  type PresentationContent,
} from '../../lib/didaskalia-presentation';
import { buildDayCaption, buildWeekCaption, copyText, whatsappShareUrl } from '../../lib/rhb-caption';
import { ensurePaths, type DidaskaliaStudio } from '../../lib/didaskalia';

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; content: PresentationContent; published: boolean; version: number }
  | { status: 'forbidden'; message: string }
  | { status: 'error'; message: string };

function assetUrl(fileId?: string): string | undefined {
  return fileId ? `/api/didaskalia/asset/${encodeURIComponent(fileId)}` : undefined;
}

const SlideView: React.FC<{ slide: DeckSlide }> = ({ slide }) => {
  const img = assetUrl(slide.imageFileId);
  return (
    <article className="rounded-[26px] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 p-6 sm:p-10 space-y-5 print:border-black/20 print:bg-white">
      {slide.kicker && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-300 print:text-sky-700">{slide.kicker}</p>}
      <h1 className="text-2xl sm:text-4xl font-black leading-tight">{slide.title}</h1>
      {slide.subtitle && <p className="text-sm sm:text-base text-white/70 print:text-black/70">{slide.subtitle}</p>}
      {img && (
        <img
          src={img}
          alt=""
          loading="lazy"
          className="w-full max-h-[42vh] object-cover rounded-2xl border border-white/10"
        />
      )}
      {slide.paragraphs?.map((p, i) => (
        <p key={i} className="text-sm sm:text-lg leading-relaxed text-white/85 print:text-black/85 whitespace-pre-line">{p}</p>
      ))}
      {slide.callout && (
        <div className="rounded-2xl bg-sky-500/15 border border-sky-400/30 p-4 print:bg-sky-50">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-300 print:text-sky-700">{slide.callout.label}</p>
          <p className="mt-1 text-sm sm:text-base italic leading-relaxed text-white/90 print:text-black/90 whitespace-pre-line">{slide.callout.value}</p>
        </div>
      )}
      {!!slide.fields?.length && (
        <dl className="space-y-3">
          {slide.fields.map((f) => (
            <div key={f.label}>
              <dt className="text-[10px] font-black uppercase tracking-wider text-white/50 print:text-black/50">{f.label}</dt>
              <dd className="text-sm sm:text-base leading-relaxed text-white/90 print:text-black/90 whitespace-pre-line">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!!slide.bullets?.length && (
        <ul className="space-y-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm sm:text-base leading-relaxed text-white/90 print:text-black/90">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

const ToastView: React.FC<{ toast: { title: string; type: 'success' | 'error' } | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] print:hidden">
      <p className={`rounded-full px-4 py-2 text-xs font-bold shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
        {toast.title}
      </p>
    </div>
  );
};

const CaptionPanel: React.FC<{
  route: ParsedMaterialHash;
  content: PresentationContent;
  doc: MaterialDoc;
  dayIndex?: number;
  canNotify: boolean;
  notify: (title: string, type?: 'success' | 'error') => void;
}> = ({ route, content, doc, dayIndex, canNotify, notify }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'day' | 'week'>(doc === 'rhb' && !dayIndex ? 'week' : 'day');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const build = useCallback((m: 'day' | 'week') => {
    const base = { doc, yearMonth: route.yearMonth, weekIndex: route.weekIndex, content };
    if (m === 'week') return buildWeekCaption(base);
    return buildDayCaption({ ...base, dayIndex: dayIndex || 1 });
  }, [doc, route.yearMonth, route.weekIndex, content, dayIndex]);

  useEffect(() => { setText(build(mode)); }, [build, mode, open]);

  useEffect(() => {
    if (!open || !canNotify) return;
    fetch('/api/db/groups/full', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => setGroups((d.groups || []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))))
      .catch(() => setGroups([]));
  }, [open, canNotify]);

  const onCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    notify(ok ? 'Caption disalin' : 'Gagal menyalin', ok ? 'success' : 'error');
    setTimeout(() => setCopied(false), 1800);
  };

  const onShare = async () => {
    const url = materialAbsoluteUrl({ ...route, dayIndex: mode === 'day' ? (dayIndex || 1) : undefined });
    try {
      if (navigator.share) await navigator.share({ title: MATERIAL_DOC_LABEL[doc], text, url });
      else window.open(whatsappShareUrl(text), '_blank', 'noopener');
    } catch {
      /* dibatalkan pengguna */
    }
  };

  const onNotify = async () => {
    if (!groupIds.length) { notify('Pilih minimal satu kelompok.', 'error'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/announcements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${MATERIAL_DOC_LABEL[doc]} Pekan ${route.weekIndex} siap`,
          message: text,
          category: 'materi',
          audienceType: 'GROUP',
          audienceGroupIds: groupIds,
          href: materialHashPath({ ...route, dayIndex: mode === 'day' ? (dayIndex || 1) : undefined }),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim notifikasi.');
      await fetch(`/api/announcements/${d.announcement?.id || d.id}/send`, { method: 'POST', credentials: 'include' }).catch(() => null);
      setSent(true);
      notify('Notifikasi terkirim ke kelompok', 'success');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal mengirim.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
      >
        <MessageCircle className="w-3.5 h-3.5" /> Caption
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3 print:hidden" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-[#111A2B] border border-white/10 p-5 space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">Caption siap kirim</h3>
              {doc === 'rhb' && (
                <div className="flex rounded-full bg-white/10 p-0.5 text-[11px] font-bold">
                  <button type="button" onClick={() => setMode('day')} className={`px-3 py-1 rounded-full ${mode === 'day' ? 'bg-sky-500 text-white' : 'text-white/70'}`}>Harian</button>
                  <button type="button" onClick={() => setMode('week')} className={`px-3 py-1 rounded-full ${mode === 'week' ? 'bg-sky-500 text-white' : 'text-white/70'}`}>Sepekan</button>
                </div>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={11}
              className="w-full rounded-2xl bg-black/30 border border-white/10 p-3 text-xs text-white/90 font-mono leading-relaxed focus:outline-none focus:border-sky-400"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs font-black text-white transition">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Salin
              </button>
              <button type="button" onClick={onShare} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white transition">
                <Share2 className="w-3.5 h-3.5" /> Bagikan
              </button>
              <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-black text-white transition">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>

            {canNotify && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Kirim notifikasi aplikasi ke kelompok
                </p>
                {groups.length === 0 ? (
                  <p className="text-[11px] text-white/50 italic">Tidak ada kelompok yang bisa dipilih.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {groups.map((g) => {
                      const on = groupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGroupIds((prev) => (on ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold border transition ${on ? 'bg-sky-500 border-sky-400 text-white' : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'}`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onNotify}
                  disabled={sending || sent || !groupIds.length}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white transition"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  {sent ? 'Terkirim' : 'Kirim notifikasi'}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-full bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-white/70 transition">
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const RhbIndex: React.FC<{ route: ParsedMaterialHash; content: PresentationContent; version: number; notify: (title: string, type?: 'success' | 'error') => void; canNotify: boolean }> = ({ route, content, version, notify, canNotify }) => {
  const days = rhbDayList(content);
  return (
    <div className="min-h-[100dvh] bg-[#0B1220] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-300">RHB 7 Hari · Pekan {route.weekIndex} · v{version}</p>
          <h1 className="text-2xl sm:text-3xl font-black">{content.theme || content.kitabFokus || `Pekan ${route.weekIndex}`}</h1>
          <p className="text-sm text-white/60">{[content.date, content.chapterNo].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CaptionPanel route={route} content={content} doc="rhb" canNotify={canNotify} notify={notify} />
          <a href="#/portal" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition">
            <BookOpen className="w-3.5 h-3.5" /> Portal
          </a>
        </div>
        <ul className="space-y-2">
          {days.map((d) => (
            <li key={d.dayIndex}>
              <a
                href={materialHashPath({ ...route, dayIndex: d.dayIndex })}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-4 py-3 transition"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-500/20 text-xs font-black text-sky-300">{d.dayIndex}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-white/50">{d.dayLabel}</span>
                  <span className="block text-sm font-bold truncate">{d.title}</span>
                  {d.ref && <span className="block text-[11px] text-white/50 truncate">{d.ref}</span>}
                </span>
                <span className="text-xs font-bold text-sky-300">Buka →</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default function DidaskaliaPresentation() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [canNotify, setCanNotify] = useState(false);
  const [toast, setToast] = useState<{ title: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((title: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const route = useMemo(() => parseMaterialHash(hash), [hash]);

  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    setState({ status: 'loading' });
    const qs = new URLSearchParams({ doc: route.doc });
    if (route.dayIndex) qs.set('day', String(route.dayIndex));
    fetch(`/api/didaskalia/presentation/${route.yearMonth}/${route.weekIndex}?${qs.toString()}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          const next = encodeURIComponent(hash || materialHashPath(route));
          window.location.hash = `#/login?next=${next}`;
          return;
        }
        const d = await r.json().catch(() => ({}));
        if (r.status === 403) { setState({ status: 'forbidden', message: d.error || 'Tidak berhak mengakses materi ini.' }); return; }
        if (!r.ok) { setState({ status: 'error', message: d.error || `Gagal memuat (server ${r.status}).` }); return; }
        const studio = d.studio as DidaskaliaStudio;
        const content = contentFromStudio(studio, route.weekIndex, d.meta?.date || '', d.meta?.theme || '');
        if (d.snapshot) {
          const snap = d.snapshot as { paths?: DidaskaliaStudio['paths']; sermon?: DidaskaliaStudio['sermon']; images?: DidaskaliaStudio['presentation'] };
          content.paths = ensurePaths({ ...studio, paths: snap.paths || studio.paths });
          content.sermon = snap.sermon || content.sermon;
          content.images = snap.images || content.images;
        }
        setState({ status: 'ok', content, published: Boolean(d.published), version: Number(d.version) || 1 });
      })
      .catch((e) => { if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memuat.' }); });
    return () => { cancelled = true; };
  }, [route, hash]);

  useEffect(() => {
    fetch('/api/announcements/capabilities', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanNotify(Boolean(d?.categories?.includes('materi') && d?.audiences?.includes('GROUP'))))
      .catch(() => setCanNotify(false));
  }, []);

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white grid place-items-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-bold">Rute materi tidak dikenal.</p>
          <a href="#/portal" className="text-xs font-bold text-sky-300 hover:underline">Kembali ke Portal</a>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white grid place-items-center">
        <p className="flex items-center gap-2 text-sm text-white/70"><Loader2 className="w-4 h-4 animate-spin" /> Memuat materi…</p>
      </div>
    );
  }

  if (state.status === 'forbidden' || state.status === 'error') {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white grid place-items-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm font-bold">{state.message}</p>
          <p className="text-xs text-white/50">
            {state.status === 'forbidden'
              ? `Materi ini hanya untuk ${docAccess(route.doc) === 'beyonder' ? 'Beyonders (mentor/mentee)' : 'Mentor/Co-mentor & staf'}.`
              : 'Coba muat ulang halaman.'}
          </p>
          <a href="#/portal" className="inline-block rounded-full bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs font-black text-white transition">Kembali ke Portal</a>
        </div>
      </div>
    );
  }

  const { content, published, version } = state;

  if (route.doc === 'rhb' && !route.dayIndex) {
    return (
      <>
        <RhbIndex route={route} content={content} version={version} notify={notify} canNotify={canNotify} />
        <ToastView toast={toast} />
      </>
    );
  }

  const slides = buildDeck(route.doc, content, route.dayIndex);
  const docLabel = MATERIAL_DOC_LABEL[route.doc];
  const dayLabel = route.dayIndex ? content.paths[route.dayIndex - 1]?.dayLabel : '';
  const eyebrow = [docLabel, `Pekan ${route.weekIndex}`, dayLabel, `v${version}`, published ? '' : 'draf (belum rilis)'].filter(Boolean).join(' · ');

  return (
    <>
      <DeckShell
        slides={slides}
        docTitle={route.dayIndex ? `${docLabel} — ${dayLabel || `Hari ${route.dayIndex}`}` : docLabel}
        eyebrow={eyebrow}
        exitHash="#/portal"
        headerRight={
          <div className="flex items-center gap-2">
            <CaptionPanel route={route} content={content} doc={route.doc} dayIndex={route.dayIndex} canNotify={canNotify} notify={notify} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
              title="Cetak / simpan PDF"
            >
              <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        }
        renderSlide={(i) => <SlideView slide={slides[i]} />}
      />
      <div className="hidden print:block print:text-black">
        {slides.map((s) => (
          <div key={`p-${s.id}`} className="break-after-page p-6">
            <SlideView slide={s} />
          </div>
        ))}
      </div>
      <ToastView toast={toast} />
    </>
  );
}
