import React, { useState } from 'react';
import { User, Shield, Bell, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MyProfilePanel, type ProfileSectionId } from './MyProfilePanel';
import { LinkGoogleCard } from './LinkGoogleCard';
import { ChangePasswordCard } from './ChangePasswordCard';
import { UsernameCard } from './UsernameCard';
import { LoginMethodsCard } from './LoginMethodsCard';
import { AccountRolesSection } from './AccountRolesSection';
import PWASettingsPanel from '../pwa/PWASettingsPanel';
import type { AccountSection } from '../../lib/portal-routes';
import { buildPortalPath } from '../../lib/portal-routes';
import { ScrollTabBar } from './ScrollTabBar';
import { useLang } from '../../context/LangContext';
import { PanelGuide } from './PanelGuide';

const TAB_IDS: { id: AccountSection; icon: React.ReactNode }[] = [
  { id: 'profile', icon: <User className="w-4 h-4" /> },
  { id: 'security', icon: <Shield className="w-4 h-4" /> },
  { id: 'roles', icon: <Users className="w-4 h-4" /> },
  { id: 'notifications', icon: <Bell className="w-4 h-4" /> },
];

export const AccountHub: React.FC<{
  section: AccountSection;
  profileSection?: ProfileSectionId;
  onSectionChange?: (section: AccountSection) => void;
}> = ({ section, profileSection, onSectionChange }) => {
  const { authUser } = useApp();
  const { t } = useLang();
  const a = t.portal.account;
  const tabLabel: Record<AccountSection, string> = {
    profile: a.tabProfile,
    security: a.tabSecurity,
    roles: a.tabRoles,
    notifications: a.tabNotifications,
  };
  const [localProfileSec, setLocalProfileSec] = useState<ProfileSectionId | undefined>(profileSection);

  const go = (sec: AccountSection) => {
    onSectionChange?.(sec);
    window.location.hash = buildPortalPath({ namespace: 'account', accountSection: sec }).slice(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#1B1B1B]">{a.title}</h1>
        <p className="text-sm text-[#8C8880] mt-1">{a.subtitle}</p>
      </div>

      <PanelGuide guideId={`account.${section}`} />

      <ScrollTabBar track={false} gapClass="gap-2" active={section}>
        {TAB_IDS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            onClick={() => go(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              section === tab.id
                ? 'bg-[#1B1B1B] text-white'
                : 'bg-white border border-[#D9D7D0] text-[#8C8880] hover:border-[#1B1B1B]'
            }`}
          >
            {tab.icon}
            {tabLabel[tab.id]}
          </button>
        ))}
      </ScrollTabBar>

      <div className={section === 'profile' ? '' : 'hidden'}>
        <MyProfilePanel
          defaultOpenSection={localProfileSec || profileSection}
          onGiftSaved={() => setLocalProfileSec(undefined)}
        />
      </div>

      {section === 'security' && (
        <div className="space-y-4 max-w-xl">
          <LoginMethodsCard />
          <UsernameCard />
          <ChangePasswordCard allowSkipCurrent={!authUser?.hasPassword} />
          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5">
            <h2 className="text-sm font-bold text-[#1B1B1B] mb-3">{a.linkGoogle}</h2>
            <p className="text-[11px] text-[#8C8880] mb-3">{a.linkGoogleHint}</p>
            <LinkGoogleCard />
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = '#/forgot-password'; }}
            className="text-xs font-bold text-[#FF416C] hover:underline"
          >
            {a.forgotPassword}
          </button>
        </div>
      )}

      {section === 'roles' && <AccountRolesSection />}

      {section === 'notifications' && (
        <PWASettingsPanel onClose={() => go('profile')} />
      )}
    </div>
  );
};
