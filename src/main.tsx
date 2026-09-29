import React, {StrictMode, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LangProvider } from './context/LangContext.tsx';
import { QueryProvider } from './app/QueryProvider.tsx';
import { AppHashRouter } from './app/RouterBridge.tsx';
import { AppErrorBoundary } from './components/ErrorBoundary.tsx';
import { isHubHost, isAppHash, isAuthHash, isMaterialHash, isReportHash, isMentorPitchHash, isPitchHash, isVotingHash, resolveHostUnit } from './lib/host-context.ts';
import { resolvePortalId } from './lib/portal-profiles.ts';
import { parseMentoringHash } from './lib/mentoring.ts';
import { applyThemeForHost, initPortalTheme } from './lib/portal-themes.ts';
import { recoverBrokenClientCache } from './lib/pwa-install.ts';
import './index.css';

/** Hub, coming-soon unit, dan pitch deck dimuat terpisah dari bundle portal Pemuda. */
const ChurchHub = React.lazy(() => import('./components/hub/ChurchHub.tsx'));
const UnitLanding = React.lazy(() => import('./components/unit/UnitLanding.tsx'));
const PitchDeck = React.lazy(() => import('./components/hub/PitchDeck.tsx'));
const PitchMentor = React.lazy(() => import('./components/hub/PitchMentor.tsx'));
const DidaskaliaPresentation = React.lazy(() => import('./components/didaskalia/DidaskaliaPresentation.tsx'));
const ReportPresentation = React.lazy(() => import('./components/reports/ReportPresentation.tsx'));
const GroupLogoVote = React.lazy(() => import('./components/voting/GroupLogoVote.tsx'));
const MentoringDay = React.lazy(() => import('./components/mentoring/MentoringDay.tsx'));
const MentoringScreen = React.lazy(() => import('./components/mentoring/MentoringScreen.tsx'));
const MentoringControl = React.lazy(() => import('./components/mentoring/MentoringControl.tsx'));

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const hubHost = isHubHost(host);

/** Portal unit yang punya landing publik sendiri (selain Pemuda). */
const UNIT_LANDING_PORTALS = new Set(['men', 'women', 'teen', 'kids', 'kolom', 'community']);

const HubFallback: React.FC = () => (
  <div className="min-h-screen bg-[#FAF9F5]" aria-busy="true" />
);

/**
 * Root reaktif-hash: hub gehc.page menampilkan landing kecuali hash adalah
 * rute aplikasi (#/portal, #/admin, …) — maka portal dirender di host hub.
 */
const AppRoot: React.FC = () => {
  const [hash, setHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash : '',
  );

  // Tema portal (per domain/subdomain): default kode, lalu override branding DB.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    applyThemeForHost(window.location.hostname, window.location.search);
    void initPortalTheme(window.location.hostname, window.location.search);
  }, []);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Deck Mentor & Co-Mentor: eksplisit (#/pitch-mentor, #/panduan) atau
  // #/pitch pada host unit Pemuda (hub tetap memakai deck GEHC.page).
  if (isMentorPitchHash(hash) || (isPitchHash(hash) && !hubHost && resolveHostUnit(host) !== 'hub')) {
    return (
      <Suspense fallback={<HubFallback />}>
        <PitchMentor />
      </Suspense>
    );
  }

  if (isPitchHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <PitchDeck />
      </Suspense>
    );
  }

  // Presentasi materi Didaskalia: standalone, wajib login (RBAC dijaga endpoint).
  if (isMaterialHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <DidaskaliaPresentation />
      </Suspense>
    );
  }

  // Laporan presentasi (kas/fasilitas/bpmj/unit): standalone, wajib login.
  if (isReportHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <ReportPresentation />
      </Suspense>
    );
  }

  // Voting logo kelompok: standalone, wajib login.
  if (isVotingHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <GroupLogoVote />
      </Suspense>
    );
  }

  // Mentoring Day / pola ibadah (Didaskalia): peserta, layar proyektor, control room.
  const mentoring = parseMentoringHash(hash);
  if (mentoring) {
    return (
      <Suspense fallback={<HubFallback />}>
        {mentoring.view === 'layar' ? (
          <MentoringScreen />
        ) : mentoring.view === 'kontrol' ? (
          <MentoringControl initialSlug={mentoring.slug} />
        ) : (
          <MentoringDay />
        )}
      </Suspense>
    );
  }

  if (hubHost) {
    if (isAppHash(hash)) {
      return (
        <AppHashRouter>
          <App />
        </AppHashRouter>
      );
    }
    return (
      <Suspense fallback={<HubFallback />}>
        <ChurchHub />
      </Suspense>
    );
  }

  // Host unit non-Pemuda: landing publik unit (portal tetap lewat hash #/portal).
  const portalId = resolvePortalId(host, typeof window !== 'undefined' ? window.location.search : '');
  if (UNIT_LANDING_PORTALS.has(portalId) && !isAppHash(hash) && !isAuthHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <UnitLanding />
      </Suspense>
    );
  }

  // Semua host unit (youth/teen/kids/men/women/districts/community + fallback
  // tak dikenal) membuka portal unitnya. Hub ditangani di atas.
  return (
    <AppHashRouter>
      <App />
    </AppHashRouter>
  );
};

const RECOVER_KEY = 'gehc_stale_asset_recover_at';

/**
 * Pemulihan otomatis klien yang terjebak shell basi (umum di iOS/Safari):
 * HTML lama menunjuk aset ber-hash yang sudah hilang → React gagal mount dan
 * sebagian section tampak "hilang". Bersihkan SW + cache lalu muat ulang sekali.
 * Dibatasi 1×/60 detik agar tidak jadi loop reload saat jaringan benar-benar mati.
 */
function recoverFromStaleAsset(reason: string) {
  try {
    const last = Number(sessionStorage.getItem(RECOVER_KEY) || '0');
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RECOVER_KEY, String(Date.now()));
  } catch {
    /* storage diblokir — tetap coba pulihkan sekali */
  }
  console.warn('[gehc] memulihkan klien dari aset basi:', reason);
  void recoverBrokenClientCache().finally(() => window.location.reload());
}

const STALE_ASSET_RE = /dynamically imported module|Loading chunk|Importing a module script failed|MIME type|error loading/i;

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverFromStaleAsset('vite:preloadError');
});
window.addEventListener('error', (event: ErrorEvent) => {
  if (STALE_ASSET_RE.test(event?.message || '')) recoverFromStaleAsset(event.message);
});
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event?.reason;
  const message = typeof reason === 'string' ? reason : reason?.message || '';
  if (STALE_ASSET_RE.test(message)) recoverFromStaleAsset(message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <LangProvider>
          <AppRoot />
        </LangProvider>
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

