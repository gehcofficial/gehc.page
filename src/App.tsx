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
import { PendingPortal } from './components/portal/PendingPortal';
import { KomisiSection } from './components/public/KomisiSection';
import { MediaGallery } from './components/public/MediaGallery';
import { Footer } from './components/public/Footer';
import { PortalLayout } from './components/portal/PortalLayout';
import BenzarpreneurshipPage from './pages/BenzarpreneurshipPage';
import EventGalleryPublic from './pages/EventGalleryPublic';

const MainAppContent: React.FC = () => {
  const { activeView, publicTab, demoMode, authUser } = useApp();

  if (activeView === 'portal') {
    // Belum masuk & bukan mode demo → layar login portal (cached accounts)
    if (!authUser && !demoMode) return <PortalLogin />;
    return <PortalLayout />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] flex flex-col justify-between selection:bg-[#FF416C] selection:text-white">
      {/* Navbar with Tenant & Role Switcher */}
      <Navbar />

      {/* Public Pages View Router (hash: #/beyonders · #/leaders · #/events · #/bulletin) */}
      <main className="flex-grow">
        {publicTab === 'group-detail' && <GroupDetailPage />}
        {publicTab === 'join' && <JoinPage />}

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

      {/* Editorial Dark Curved Footer */}
      <Footer />
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

