/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastContainer } from './components/layout/ToastContainer';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { MarqueeStrip } from './components/public/MarqueeStrip';
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
import { OnboardingGatePortal } from './components/portal/OnboardingGatePortal';
import { KomisiSection } from './components/public/KomisiSection';
import { MediaGallery } from './components/public/MediaGallery';
import { Footer } from './components/public/Footer';
import { ClaimPage } from './components/public/ClaimPage';
import { PortalLayout } from './components/portal/PortalLayout';
import { ApplyPendingBakutau } from './components/portal/ApplyPendingBakutau';
import BenzarpreneurshipPage from './pages/BenzarpreneurshipPage';
import EventGalleryPublic from './pages/EventGalleryPublic';
import { RegisterPage } from './components/public/auth/RegisterPage';
import { EventSignupRouter } from './components/public/auth/EventSignupRouter';

const AUTH_PUBLIC_TABS = new Set(['login']);

const MainAppContent: React.FC = () => {
  const { activeView, publicTab, demoMode, authUser } = useApp();

  if (typeof window !== 'undefined' && window.location.hash.startsWith('#/claim')) {
    return <ClaimPage />;
  }

  if (publicTab === 'login') {
    return <PortalLogin />;
  }

  if (activeView === 'portal') {
    if (!authUser && !demoMode) return <PortalLogin />;

    const pendingSync = authUser ? <ApplyPendingBakutau /> : null;
    const onboardingStatus = authUser?.onboardingStatus;
    if (onboardingStatus === 'WAITING_POOL') {
      return <>{pendingSync}<OnboardingGatePortal mode="WAITING_POOL" /></>;
    }
    if (authUser?.accountStatus === 'PENDING') {
      return <>{pendingSync}<OnboardingGatePortal mode="PENDING" /></>;
    }

    return <>{pendingSync}<PortalLayout /></>;
  }

  const authShell = AUTH_PUBLIC_TABS.has(publicTab);

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-[#FF416C] selection:text-white ${
      authShell ? 'bg-[#FAF9F5] text-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#1B1B1B]'
    }`}>
      {!authShell && <Navbar />}

      <main className="flex-grow">
        {publicTab === 'register' && <RegisterPage />}
        {publicTab === 'event-signup' && <EventSignupRouter />}
        {publicTab === 'join' && <JoinPage />}

        {publicTab === 'group-detail' && <GroupDetailPage />}

        {publicTab === 'beyonders' && (
          <>
            <HeroSection />
            <MarqueeStrip />
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
          <>
            <EventsTimeline condensed={false} showHeader={false} />
            <MediaGallery />
          </>
        )}

        {publicTab === 'bulletin' && <WeeklyInfoSection />}
        {publicTab === 'benzarpreneurship' && <BenzarpreneurshipPage />}
        {publicTab === 'gallery' && <EventGalleryPublic />}
      </main>

      {!authShell && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
      <ToastContainer />
    </AppProvider>
  );
}
