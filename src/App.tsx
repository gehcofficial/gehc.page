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
import { ManifestoSection } from './components/public/ManifestoSection';
import { EcosystemPillars } from './components/public/EcosystemPillars';
import { WeeklyInfoSection } from './components/public/WeeklyInfoSection';
import { ActivitiesSection } from './components/public/ActivitiesSection';
import { GroupsSection } from './components/public/GroupsSection';
import { StrukturSection } from './components/public/StrukturSection';
import { Footer } from './components/public/Footer';
import { PortalLayout } from './components/portal/PortalLayout';

const MainAppContent: React.FC = () => {
  const { activeView, publicTab } = useApp();

  if (activeView === 'portal') {
    return <PortalLayout />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] flex flex-col justify-between selection:bg-[#FF416C] selection:text-white">
      {/* Navbar with Tenant & Role Switcher */}
      <Navbar />

      {/* Public Pages View Router */}
      <main className="flex-grow">
        {publicTab === 'home' && (
          <>
            <HeroSection />
            <MarqueeStrip />
            <VisualCollage />
            <ManifestoSection />
            <WeeklyInfoSection />
            <EcosystemPillars />
          </>
        )}

        {publicTab === 'weekly-info' && <WeeklyInfoSection />}

        {publicTab === 'activity' && <ActivitiesSection />}

        {publicTab === 'groups' && <GroupsSection />}

        {publicTab === 'struktur' && <StrukturSection />}
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

