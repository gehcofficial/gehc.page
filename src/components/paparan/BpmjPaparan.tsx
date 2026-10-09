/**
 * Paparan internal pimpinan (#/paparan/bpmj-2026-10).
 * Standalone (di luar shell portal), wajib login, RBAC di endpoint
 * (SUPERADMIN + BPMJ + KOMISI). Isi slide diambil dari API — tidak ada
 * di bundle klien. Sengaja TANPA tombol bagikan agar tautan tak tersebar.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Printer, ShieldAlert } from 'lucide-react';
import { DeckShell } from '../presentation/DeckShell';
import { parsePaparanHash } from '../../lib/paparan-routing';
import type { ReportSlide } from '../../lib/report-decks';

type State =
  | { status: 'loading' }
  | { status: 'ok'; title: string; slides: ReportSlide[] }
  | { status: 'auth' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

const SlideView: React.FC<{ slide: ReportSlide }> = ({ slide }) => (
  <article className="rounded-[26px] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 p-6 sm:p-10 space-y-5 print:border-black/20 print:bg-white print:text-black">
    {slide.kicker && <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300 print:text-amber-700">{slide.kicker}</p>}
    <h1 className="text-2xl sm:text-4xl font-black leading-tight print:text-black">{slide.title}</h1>
    {slide.subtitle && <p className="text-sm sm:text-base text-white/70 print:text-black/70">{slide.subtitle}</p>}
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
            <span className="text-amber-300 print:text-amber-700">•</span>
            <span className="whitespace-pre-line">{b}</span>
          </li>
        ))}
      </ul>
    )}
    {slide.callout && (
      <div className="rounded-2xl p-4 border bg-amber-500/15 border-amber-400/30 print:bg-amber-50 print:border-amber-300">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300 print:text-amber-700">{slide.callout.label}</p>
        <p className="mt-1 text-sm sm:text-base text-white/95 print:text-black/90">{slide.callout.value}</p>
      </div>
    )}
  </article>
);

export const BpmjPaparan: React.FC = () => {
  const [route, setRoute] = useState(() =>
    parsePaparanHash(typeof window !== 'undefined' ? window.location.hash : ''),
  );
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const onHash = () => setRoute(parsePaparanHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(`/api/paparan/${encodeURIComponent(route.slug)}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) return { status: 'auth' as const };
        if (r.status === 403) return { status: 'forbidden' as const };
        if (!r.ok) return { status: 'error' as const, message: (await r.json().catch(() => ({}))).error || `HTTP ${r.status}` };
        const d = await r.json();
        if (!d || !Array.isArray(d.slides)) return { status: 'error' as const, message: 'Isi paparan tak valid.' };
        return { status: 'ok' as const, title: String(d.title || 'Paparan'), slides: d.slides as ReportSlide[] };
      })
      .then((res) => {
        if (!cancelled) setState(res as State);
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', message: String(e?.message || e) });
      });
    return () => {
      cancelled = true;
    };
  }, [route?.slug]);

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-bold">Tautan paparan tidak valid.</p>
          <a href="#/portal" className="mt-3 inline-block text-xs font-bold text-sky-300 underline">Kembali ke portal</a>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-[#0B1220] text-white flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Memuat paparan…</span>
      </div>
    );
  }

  if (state.status === 'auth' || state.status === 'forbidden' || state.status === 'error') {
    const msg = state.status === 'auth' ? 'Perlu login untuk membuka paparan ini.'
      : state.status === 'forbidden' ? 'Paparan ini khusus pimpinan (BPMJ/Komisi).'
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
  return (
    <>
      <DeckShell
        slides={slides}
        docTitle={state.title}
        eyebrow="Paparan BPMJ"
        exitHash="#/portal"
        headerRight={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
            title="Cetak / simpan PDF"
          >
            <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak</span>
          </button>
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
    </>
  );
};

export default BpmjPaparan;
