/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppProvider, useApp } from './context/AppContext';
import { MediaSlotsWarmup, prefetchMediaSlots } from './hooks/useMediaSlots';
import { ToastContainer } from './components/layout/ToastContainer';
import { PwaUpdateToast } from './components/pwa/PwaUpdateToast';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { Footer } from './components/public/Footer';
import { PortalLogin } from './components/portal/PortalLogin';
import { PortalLayout } from './components/portal/PortalLayout';
import { ApplyPendingBakutau } from './components/portal/ApplyPendingBakutau';
import { AdminLayout } from './components/admin/AdminLayout';
import { isAdminHash } from './lib/admin-routes';
import { isPortalHash } from './lib/portal-routes';
import { useOurPeopleUnlock } from './lib/our-people-unlock';
import { LoadingOverlay } from './components/public/ui/LoadingOverlay';

// Section landing dipecah per tab agar bundle awal ringan (LCP Hero saja).
// Tab Warta/Kegiatan yang berat baru diunduh saat dibuka.
const VisualCollage = React.lazy(() => import('./components/public/VisualCollage').then((m) => ({ default: m.VisualCollage })));
const AboutSection = React.lazy(() => import('./components/public/AboutSection').then((m) => ({ default: m.AboutSection })));
const RegenerationFlowSection = React.lazy(() => import('./components/public/RegenerationFlowSection').then((m) => ({ default: m.RegenerationFlowSection })));
const GroupsCarousel = React.lazy(() => import('./components/public/GroupsCarousel').then((m) => ({ default: m.GroupsCarousel })));
const GroupActivitySection = React.lazy(() => import('./components/public/GroupActivitySection').then((m) => ({ default: m.GroupActivitySection })));
const PantatugasShowcase = React.lazy(() => import('./components/public/PantatugasShowcase').then((m) => ({ default: m.PantatugasShowcase })));
const EventsTimeline = React.lazy(() => import('./components/public/EventsTimeline').then((m) => ({ default: m.EventsTimeline })));
const ChurchYearSection = React.lazy(() => import('./components/public/ChurchYearSection').then((m) => ({ default: m.ChurchYearSection })));
const EventArchiveGallery = React.lazy(() => import('./components/public/EventArchiveGallery').then((m) => ({ default: m.EventArchiveGallery })));
const WeeklyInfoSection = React.lazy(() => import('./components/public/WeeklyInfoSection').then((m) => ({ default: m.WeeklyInfoSection })));
const GroupDetailPage = React.lazy(() => import('./components/public/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })));
const JoinPage = React.lazy(() => import('./components/public/JoinPage').then((m) => ({ default: m.JoinPage })));
const KomisiSection = React.lazy(() => import('./components/public/KomisiSection').then((m) => ({ default: m.KomisiSection })));
const ClaimPage = React.lazy(() => import('./components/public/ClaimPage').then((m) => ({ default: m.ClaimPage })));
const ForgotPasswordPage = React.lazy(() => import('./components/public/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./components/public/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const BenzarpreneurshipPage = React.lazy(() => import('./pages/BenzarpreneurshipPage'));
const RegisterPage = React.lazy(() => import('./components/public/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const EventSignupRouter = React.lazy(() => import('./components/public/auth/EventSignupRouter').then((m) => ({ default: m.EventSignupRouter })));

const SectionFallback: React.FC = () => (
  <LoadingOverlay variant="fullscreen" kind="generic" />
);

const AUTH_PUBLIC_TABS = new Set(['login', 'register']);

const SessionRestoreScreen: React.FC = () => (
  <LoadingOverlay variant="fullscreen" kind="sessions" timeoutMs={25000} />
);

const MainAppContent: React.FC = () => {
  const { activeView, publicTab, authUser, authLoading } = useApp();
  const { unlocked: ourPeopleUnlocked } = useOurPeopleUnlock();
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  if (hash.startsWith('#/claim')) {
    return (
      <Suspense fallback={<SectionFallback />}>
        <ClaimPage />
      </Suspense>
    );
  }

  if (hash.startsWith('#/forgot-password')) {
    return (
      <Suspense fallback={<SectionFallback />}>
        <ForgotPasswordPage />
      </Suspense>
    );
  }

  if (hash.startsWith('#/reset-password')) {
    return (
      <Suspense fallback={<SectionFallback />}>
        <ResetPasswordPage />
      </Suspense>
    );
  }

  if (activeView === 'admin' || isAdminHash(hash)) {
    return <AdminLayout />;
  }

  // Hash is source of truth: refresh of #/portal/... must stay in the portal shell
  // even if activeView was left on 'public'.
  if (isPortalHash(hash) || activeView === 'portal') {
    if (authLoading) return <SessionRestoreScreen />;
    if (!authUser) return <PortalLogin />;

    const pendingSync = authUser ? <ApplyPendingBakutau /> : null;
    return <>{pendingSync}<PortalLayout /></>;
  }

  if (publicTab === 'login') {
    return <PortalLogin />;
  }

  if (publicTab === 'register') {
    return (
      <Suspense fallback={<SectionFallback />}>
        <RegisterPage />
      </Suspense>
    );
  }

  const authShell = AUTH_PUBLIC_TABS.has(publicTab);

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-brand selection:text-white ${
      authShell ? 'bg-[#FAF9F5] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#1B1B1B]'
    }`}>
      {!authShell && <Navbar />}

      <main className="flex-grow">
        {publicTab === 'event-signup' && (
          <Suspense fallback={<SectionFallback />}>
            <EventSignupRouter />
          </Suspense>
        )}
        {publicTab === 'join' && (
          <Suspense fallback={<SectionFallback />}>
            <JoinPage />
          </Suspense>
        )}

        {publicTab === 'group-detail' && (
          <Suspense fallback={<SectionFallback />}>
            <GroupDetailPage />
          </Suspense>
        )}

        {publicTab === 'beyonders' && (
          <>
            <HeroSection />
            <Suspense fallback={<SectionFallback />}>
              <GroupsCarousel />
              <GroupActivitySection />
              <RegenerationFlowSection />
              <VisualCollage />
            </Suspense>
          </>
        )}

        {publicTab === 'leaders' && (
          <Suspense fallback={<SectionFallback />}>
            <AboutSection />
            <PantatugasShowcase />
            {ourPeopleUnlocked && <KomisiSection />}
          </Suspense>
        )}

        {publicTab === 'events' && (
          <Suspense fallback={<SectionFallback />}>
            <EventsTimeline condensed={false} showHeader={false} />
            <ChurchYearSection limit={9} />
          </Suspense>
        )}

        {publicTab === 'bulletin' && (
          <Suspense fallback={<SectionFallback />}>
            <WeeklyInfoSection />
            <EventArchiveGallery />
          </Suspense>
        )}
        {publicTab === 'benzarpreneurship' && (
          <Suspense fallback={<SectionFallback />}>
            <BenzarpreneurshipPage />
          </Suspense>
        )}
      </main>

      {!authShell && <Footer />}
    </div>
  );
};

export default function App() {
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchMediaSlots(queryClient);
    // Hangatkan endpoint publik kritis saat idle agar tab Warta/Kegiatan
    // tidak menunggu fetch pertama (server sudah kirim Cache-Control + SWR).
    const warm = () => {
      fetch('/api/content/public?limit=30').catch(() => {});
      fetch('/api/events/landing').catch(() => {});
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (typeof ric === 'function') ric(warm);
    else {
      const t = setTimeout(warm, 1500);
      return () => clearTimeout(t);
    }
  }, [queryClient]);

  return (
    <AppProvider>
      <MediaSlotsWarmup />
      <MainAppContent />
      <PwaUpdateToast />
      <ToastContainer />
    </AppProvider>
  );
}

