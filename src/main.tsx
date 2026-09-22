import React, {StrictMode, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LangProvider } from './context/LangContext.tsx';
import { QueryProvider } from './app/QueryProvider.tsx';
import { AppHashRouter } from './app/RouterBridge.tsx';
import { AppErrorBoundary } from './components/ErrorBoundary.tsx';
import { isHubHost, isAppHash, isMaterialHash, isMentorPitchHash, isPitchHash, resolveHostUnit } from './lib/host-context.ts';
import { recoverBrokenClientCache } from './lib/pwa-install.ts';
import './index.css';

/** Hub, coming-soon unit, dan pitch deck dimuat terpisah dari bundle portal Pemuda. */
const ChurchHub = React.lazy(() => import('./components/hub/ChurchHub.tsx'));
const UnitComingSoon = React.lazy(() => import('./components/hub/UnitComingSoon.tsx'));
const PitchDeck = React.lazy(() => import('./components/hub/PitchDeck.tsx'));
const PitchMentor = React.lazy(() => import('./components/hub/PitchMentor.tsx'));
const DidaskaliaPresentation = React.lazy(() => import('./components/didaskalia/DidaskaliaPresentation.tsx'));

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const hostUnit = resolveHostUnit(host);
const hubHost = isHubHost(host);

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

  if (hostUnit === 'youth' || hostUnit === 'default') {
    return (
      <AppHashRouter>
        <App />
      </AppHashRouter>
    );
  }

  return (
    <Suspense fallback={<HubFallback />}>
      <UnitComingSoon unit={hostUnit} />
    </Suspense>
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
