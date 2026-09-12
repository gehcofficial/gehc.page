import React, {StrictMode, Suspense, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LangProvider } from './context/LangContext.tsx';
import { QueryProvider } from './app/QueryProvider.tsx';
import { AppHashRouter } from './app/RouterBridge.tsx';
import { AppErrorBoundary } from './components/ErrorBoundary.tsx';
import { isHubHost, isAppHash, isPitchHash, resolveHostUnit } from './lib/host-context.ts';
import './index.css';

/** Hub, coming-soon unit, dan pitch deck dimuat terpisah dari bundle portal Pemuda. */
const ChurchHub = React.lazy(() => import('./components/hub/ChurchHub.tsx'));
const UnitComingSoon = React.lazy(() => import('./components/hub/UnitComingSoon.tsx'));
const PitchDeck = React.lazy(() => import('./components/hub/PitchDeck.tsx'));

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

  if (isPitchHash(hash)) {
    return (
      <Suspense fallback={<HubFallback />}>
        <PitchDeck />
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
