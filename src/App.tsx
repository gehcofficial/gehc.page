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
import { WeeklyInfoSection } from './components/public/WeeklyInfoSection';
import { GroupDetailPage } from './components/public/GroupDetailPage';
import { JoinPage } from './components/public/JoinPage';
import { PortalLogin } from './components/portal/PortalLogin';
import { KomisiSection } from './components/public/KomisiSection';
import { Footer } from './components/public/Footer';
import { ClaimPage } from './components/public/ClaimPage';
import { PortalLayout } from './components/portal/PortalLayout';
import { ApplyPendingBakutau } from './components/portal/ApplyPendingBakutau';
import BenzarpreneurshipPage from './pages/BenzarpreneurshipPage';
import { RegisterPage } from './components/public/auth/RegisterPage';
import { EventSignupRouter } from './components/public/auth/EventSignupRouter';

const AUTH_PUBLIC_TABS = new Set(['login', 'register']);

const MainAppContent: React.FC = () => {
  const { activeView, publicTab, authUser } = useApp();

  if (typeof window !== 'undefined' && window.location.hash.startsWith('#/claim')) {
    return <ClaimPage />;
  }

  if (publicTab === 'login') {
    return <PortalLogin />;
  }

  if (publicTab === 'register') {
    return <RegisterPage />;
  }

  if (activeView === 'portal') {
    if (!authUser) return <PortalLogin />;

    const pendingSync = authUser ? <ApplyPendingBakutau /> : null;
    return <>{pendingSync}<PortalLayout /></>;
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
            <KomisiSection />
          </>
        )}

        {publicTab === 'events' && (
          <EventsTimeline condensed={false} showHeader={false} />
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
