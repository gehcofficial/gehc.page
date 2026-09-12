import React, {StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LangProvider } from './context/LangContext.tsx';
import { QueryProvider } from './app/QueryProvider.tsx';
import { AppHashRouter } from './app/RouterBridge.tsx';
import { AppErrorBoundary } from './components/ErrorBoundary.tsx';
import { isHubHost, resolveHostUnit } from './lib/host-context.ts';
import './index.css';

/** Hub gereja (gehc.page) dimuat terpisah agar bundle portal Pemuda tidak membengkak. */
const ChurchHub = React.lazy(() => import('./components/hub/ChurchHub.tsx'));
const UnitComingSoon = React.lazy(() => import('./components/hub/UnitComingSoon.tsx'));

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const hostUnit = resolveHostUnit(host);
const showHub = isHubHost(host);
const showYouthApp = hostUnit === 'youth' || hostUnit === 'default';

const HubFallback: React.FC = () => (
  <div className="min-h-screen bg-[#FAF9F5]" aria-busy="true" />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <LangProvider>
          {showHub ? (
            <Suspense fallback={<HubFallback />}>
              <ChurchHub />
            </Suspense>
          ) : showYouthApp ? (
            <AppHashRouter>
              <App />
            </AppHashRouter>
          ) : (
            <Suspense fallback={<HubFallback />}>
              <UnitComingSoon unit={hostUnit} />
            </Suspense>
          )}
        </LangProvider>
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
