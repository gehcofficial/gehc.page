/**
 * P6 — Halaman presentasi laporan (#/laporan/<jenis>/<periode>[/<unit>]).
 * Standalone (di luar shell portal), wajib login, RBAC di endpoint.
 * Cetak → window.print() dengan blok khusus cetak (semua slide, satu per halaman).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Loader2, MessageCircle, Printer, ShieldAlert } from 'lucide-react';
import { DeckShell } from '../presentation/DeckShell';
import { copyText, whatsappShareUrl } from '../../lib/rhb-caption';
import {
  parseReportHash,
  reportAbsoluteUrl,
  reportKindLabel,
  type ParsedReportHash,
} from '../../lib/report-routing';
import {
  buildBpmjDeck,
  buildFacilityDeck,
  buildKasDeck,
  buildUnitDeck,
  type ReportSlide,
} from '../../lib/report-decks';

type State =
  | { status: 'loading' }
  | { status: 'ok'; slides: ReportSlide[]; periodLabel: string }
  | { status: 'auth' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

const SlideView: React.FC<{ slide: ReportSlide }> = ({ slide }) => (
  <article className="rounded-[26px] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 p-6 sm:p-10 space-y-5 print:border-black/20 print:bg-white print:text-black">
    {slide.kicker && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-300 print:text-sky-700">{slide.kicker}</p>}
    <h1 className="text-2xl sm:text-4xl font-black leading-tight print:text-black">{slide.title}</h1>
    {slide.subtitle && <p className="text-sm sm:text-base text-white/70 print:text-black/70">{slide.subtitle}</p>}
    {slide.paragraphs?.map((p, i) => (
      <p key={i} className="text-sm sm:text-lg leading-relaxed whitespace-pre-line text-white/85 print:text-black/85">{p}</p>
    ))}
    {!!slide.fields?.length && (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {slide.fields.map((f, i) => (
          <div key={i} className="rounded-2xl border border-white/10 p-3 print:border-black/20">
            <dt className="text-[10px] font-black uppercase tracking-wider text-white/50 print:text-black/50">{f.label}</dt>
            <dd className="text-sm sm:text-base text-white/95 print:text-black/90">{f.value}</dd>
          </div>
        ))}
      </dl>
    )}
    {!!slide.bullets?.length && (
      <ul className="space-y-1.5">
        {slide.bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm sm:text-base leading-relaxed text-white/90 print:text-black/90">
            <span className="text-sky-300 print:text-sky-700">•</span>
            <span className="whitespace-pre-line">{b}</span>
          </li>
        ))}
      </ul>
    )}
    {slide.callout && (
      <div className="rounded-2xl p-4 border bg-sky-500/15 border-sky-400/30 print:bg-sky-50 print:border-sky-300">
        <p className="text-[10px] font-black uppercase tracking-wider text-sky-300 print:text-sky-700">{slide.callout.label}</p>
        <p className="mt-1 text-sm sm:text-base text-white/95 print:text-black/90">{slide.callout.value}</p>
      </div>
    )}
  </article>
);

export const ReportPresentation: React.FC = () => {
  const [route, setRoute] = useState<ParsedReportHash | null>(() =>
    parseReportHash(typeof window !== 'undefined' ? window.location.hash : ''),
  );
  const [state, setState] = useState<State>({ status: 'loading' });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseReportHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    setState({ status: 'loading' });
    const qs = route.kind === 'unit'
      ? `unit=${encodeURIComponent(route.unit || '')}&period=${encodeURIComponent(route.period)}`
      : `period=${encodeURIComponent(route.period)}`;
    fetch(`/api/church/reports/${route.kind}?${qs}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) return { status: 'auth' as const };
        if (r.status === 403) return { status: 'forbidden' as const };
        if (!r.ok) return { status: 'error' as const, message: (await r.json().catch(() => ({}))).error || `HTTP ${r.status}` };
        const d = await r.json();
        return { status: 'ok' as const, data: d };
      })
      .then((res) => {
        if (cancelled) return;
        if (res.status !== 'ok') {
          setState(res as State);
          return;
        }
        const d = res.data;
        const slides =
          route.kind === 'kas' ? buildKasDeck(d)
          : route.kind === 'fasilitas' ? buildFacilityDeck(d)
          : route.kind === 'bpmj' ? buildBpmjDeck(d)
          : buildUnitDeck(d);
        setState({ status: 'ok', slides, periodLabel: d?.period?.label || route.period });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', message: String(e?.message || e) });
      });
    return () => {
      cancelled = true;
    };
  }, [route?.kind, route?.period, route?.unit]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  const docTitle = useMemo(
    () => (route ? `${reportKindLabel(route.kind)} — ${state.status === 'ok' ? state.periodLabel : route.period}` : 'Laporan'),
    [route, state],
  );

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-bold">Tautan laporan tidak valid.</p>
          <a href="#/portal" className="mt-3 inline-block text-xs font-bold text-sky-300 underline">Kembali ke portal</a>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Memuat laporan…</span>
      </div>
    );
  }

  if (state.status === 'auth' || state.status === 'forbidden' || state.status === 'error') {
    const msg = state.status === 'auth' ? 'Perlu login untuk membuka laporan.'
      : state.status === 'forbidden' ? 'Akses laporan ini dibatasi (Bendahara/BPMJ/pengelola).'
      : `Gagal memuat: ${state.message}`;
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <ShieldAlert className="w-6 h-6 mx-auto text-amber-300" />
          <p className="mt-3 text-sm font-bold">{msg}</p>
          <a href="#/portal" className="mt-3 inline-block text-xs font-bold text-sky-300 underline">Buka portal / login</a>
        </div>
      </div>
    );
  }

  const slides = state.slides;
  const url = reportAbsoluteUrl(route);
  const caption = `${reportKindLabel(route.kind)} — ${state.periodLabel}\n${url}`;
  const pdfUrl = route.kind === 'unit'
    ? `/api/church/reports/unit.pdf?unit=${encodeURIComponent(route.unit || '')}&period=${encodeURIComponent(route.period)}`
    : `/api/church/reports/${route.kind}.pdf?period=${encodeURIComponent(route.period)}`;

  return (
    <>
      <DeckShell
        slides={slides}
        docTitle={docTitle}
        eyebrow="Laporan"
        exitHash="#/portal"
        headerRight={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => showToast((await copyText(caption)) ? 'Tautan disalin' : 'Gagal menyalin')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
              title="Salin tautan"
            >
              <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Salin tautan</span>
            </button>
            <a
              href={whatsappShareUrl(caption)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
              title="Bagikan via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">WA</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
              title="Cetak / simpan PDF"
            >
              <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak</span>
            </button>
            <a
              href={pdfUrl}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/90 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition"
              title="Unduh PDF (server)"
            >
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">PDF</span>
            </a>
          </div>
        }
        renderSlide={(i) => <SlideView slide={slides[i]} />}
      />

      {/* Blok khusus cetak: semua slide, satu per halaman → PDF lengkap. */}
      <div className="hidden print:block print:text-black">
        {slides.map((s) => (
          <div key={`p-${s.id}`} className="break-after-page p-6">
            <SlideView slide={s} />
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-black/80 text-white text-xs font-bold px-4 py-2 print:hidden">
          {toast}
        </div>
      )}
    </>
  );
};

export default ReportPresentation;
