/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppProvider, useApp } from './context/AppContext';
import { MediaSlotsWarmup, prefetchMediaSlots } from './hooks/useMediaSlots';
import { ToastContainer } from './components/layout/ToastContainer';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { VisualCollage } from './components/public/VisualCollage';
import { AboutSection } from './components/public/AboutSection';
import { RegenerationFlowSection } from './components/public/RegenerationFlowSection';
import { GroupsCarousel } from './components/public/GroupsCarousel';
import { PantatugasShowcase } from './components/public/PantatugasShowcase';
import { EventsTimeline } from './components/public/EventsTimeline';
import { ChurchYearSection } from './components/public/ChurchYearSection';
import { WeeklyInfoSection } from './components/public/WeeklyInfoSection';
import { GroupDetailPage } from './components/public/GroupDetailPage';
import { JoinPage } from './components/public/JoinPage';
import { PortalLogin } from './components/portal/PortalLogin';
import { KomisiSection } from './components/public/KomisiSection';
import { Footer } from './components/public/Footer';
import { ClaimPage } from './components/public/ClaimPage';
import { ForgotPasswordPage } from './components/public/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/public/auth/ResetPasswordPage';
import { PortalLayout } from './components/portal/PortalLayout';
import { ApplyPendingBakutau } from './components/portal/ApplyPendingBakutau';
import BenzarpreneurshipPage from './pages/BenzarpreneurshipPage';
import { RegisterPage } from './components/public/auth/RegisterPage';
import { EventSignupRouter } from './components/public/auth/EventSignupRouter';
import { AdminLayout } from './components/admin/AdminLayout';
import { isAdminHash } from './lib/admin-routes';
import { isPortalHash } from './lib/portal-routes';
import { useOurPeopleUnlock } from './lib/our-people-unlock';
import { Loader2 } from 'lucide-react';

const AUTH_PUBLIC_TABS = new Set(['login', 'register']);

const SessionRestoreScreen: React.FC = () => (
  <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
    <p className="text-sm text-white/60 flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Memulihkan sesi…
    </p>
  </div>
);

const MainAppContent: React.FC = () => {
  const { activeView, publicTab, authUser, authLoading } = useApp();
  const { unlocked: ourPeopleUnlocked } = useOurPeopleUnlock();
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  if (hash.startsWith('#/claim')) {
    return <ClaimPage />;
  }

  if (hash.startsWith('#/forgot-password')) {
    return <ForgotPasswordPage />;
  }

  if (hash.startsWith('#/reset-password')) {
    return <ResetPasswordPage />;
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
    return <RegisterPage />;
  }

  const authShell = AUTH_PUBLIC_TABS.has(publicTab);

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-[#FF416C] selection:text-white ${
      authShell ? 'bg-[#FAF9F5] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#1B1B1B]'
    }`}>
      {!authShell && <Navbar />}

      <main className="flex-grow">
        {publicTab === 'event-signup' && <EventSignupRouter />}
        {publicTab === 'join' && <JoinPage />}

        {publicTab === 'group-detail' && <GroupDetailPage />}

        {publicTab === 'beyonders' && (
          <>
            <HeroSection />
            <GroupsCarousel />
            <RegenerationFlowSection />
            <VisualCollage />
          </>
        )}

        {publicTab === 'leaders' && (
          <>
            <AboutSection />
            <PantatugasShowcase />
            {ourPeopleUnlocked && <KomisiSection />}
          </>
        )}

        {publicTab === 'events' && (
          <>
            <EventsTimeline condensed={false} showHeader={false} />
            <ChurchYearSection limit={9} />
          </>
        )}

        {publicTab === 'bulletin' && <WeeklyInfoSection />}
        {publicTab === 'benzarpreneurship' && <BenzarpreneurshipPage />}
      </main>

      {!authShell && <Footer />}
    </div>
  );
};

export default function App() {
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchMediaSlots(queryClient);
  }, [queryClient]);

  return (
    <AppProvider>
      <MediaSlotsWarmup />
      <MainAppContent />
      <ToastContainer />
    </AppProvider>
  );
}
