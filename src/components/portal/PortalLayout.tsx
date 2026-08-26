import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PortalDashboard } from './PortalDashboard';
import { ManageWeeklyInfo } from './ManageWeeklyInfo';
import { ManageActivities } from './ManageActivities';
import { ManageGroupsMonitoring } from './ManageGroupsMonitoring';
import { ManageStruktur } from './ManageStruktur';
import { ManageUsersRBAC } from './ManageUsersRBAC';
import { ManageIntegrations } from './ManageIntegrations';
import { MediaGuidePanel } from './MediaGuidePanel';
import { EventWorkspacePanel } from './EventWorkspacePanel';
import { JethroEngine } from './JethroEngine';
import { PortalAccountSwitcher } from './PortalAccountSwitcher';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { PeopleInvites } from './PeopleInvites';
import { WaitlistBoard } from './WaitlistBoard';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  ShieldCheck,
  ShieldAlert,
  FolderSync,
  ArrowLeft,
  LogOut,
  ChevronRight,
  Shield,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  UsersRound,
  ClipboardList,
  Images,
} from 'lucide-react';

export const PortalLayout: React.FC = () => {
  const {
    currentTenant,
    currentUser,
    currentRole,
    isSuperAdmin,
    isCommittee,
    isMentor,
    setActiveView,
    allUsers,
    setCurrentUser,
    addToast,
    demoMode,
    authUser,
    ssoClientId,
    sessionSource,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Ringkasan',
      icon: LayoutDashboard,
      roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTEE'],
      group: 'Utama',
    },
    {
      id: 'people',
      label: 'Orang & Undangan',
      icon: UsersRound,
      roles: ['SUPERADMIN', 'KOMISI'],
      group: 'Komunitas',
    },
    {
      id: 'waitlist',
      label: 'Waitlist Newcomer',
      icon: ClipboardList,
      roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'],
      group: 'Komunitas',
    },
    {
      id: 'groups-monitoring',
      label: isMentor ? 'Monitoring Kelompok Binaan' : 'Monitoring 10 Kelompok',
      icon: Users,
      roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTEE'],
      group: 'Komunitas',
    },
    {
      id: 'jethro',
      label: 'Jethro Engine (Regenerasi)',
      icon: Sparkles,
      roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'],
      group: 'Komunitas',
    },
    {
      id: 'content-weekly',
      label: 'Kelola Warta Pemuda',
      icon: BookOpen,
      roles: ['SUPERADMIN', 'COMMITTEE'],
      group: 'Konten',
    },
    {
      id: 'content-activities',
      label: 'Kelola Agenda Kegiatan',
      icon: Calendar,
      roles: ['SUPERADMIN', 'COMMITTEE'],
      group: 'Konten',
    },
    {
      id: 'media-guide',
      label: 'Panduan Media (Drive)',
      icon: Images,
      roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'],
      group: 'Konten',
    },
    {
      id: 'struktur',
      label: 'Struktur Organisasi (Org Chart)',
      icon: ShieldCheck,
      roles: ['SUPERADMIN', 'COMMITTEE'],
      group: 'Struktur',
    },
    {
      id: 'events',
      label: 'Program & Event',
      icon: Calendar,
      roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'],
      group: 'Kerja',
    },
    {
      id: 'users-rbac',
      label: 'Pengguna & Matrix RBAC',
      icon: ShieldAlert,
      roles: ['SUPERADMIN'],
      badge: 'Superadmin Only',
      group: 'Sistem',
    },
    {
      id: 'integrations',
      label: 'Integrasi Google Drive',
      icon: FolderSync,
      roles: ['SUPERADMIN'],
      badge: 'Superadmin Only',
      group: 'Sistem',
    },
  ];

  // Render dengan header grup saat berganti
  const navWithHeaders: Array<{ type: 'header'; label: string } | { type: 'item'; item: typeof navItems[number] }> = [];
  let lastGroup = '';
  for (const item of navItems) {
    if (item.group && item.group !== lastGroup) {
      navWithHeaders.push({ type: 'header', label: item.group });
      lastGroup = item.group;
    }
    navWithHeaders.push({ type: 'item', item });
  }

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col md:flex-row text-[#1B1B1B]">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#D9D7D0] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white font-bold text-xs">
            GEHC
          </div>
          <div>
            <h4 className="text-xs font-bold leading-tight">User Portal</h4>
            <span className="text-[10px] text-[#8C8880]">{currentTenant.name}</span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-gray-100 text-[#1B1B1B]"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-30 h-screen w-72 bg-white border-r border-[#D9D7D0]/60 p-6 flex flex-col justify-between transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          
          {/* Logo & Back to Site */}
          <div>
            <button
              onClick={() => setActiveView('public')}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#8C8880] hover:text-[#FF416C] transition-colors mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Web Publik</span>
            </button>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/50">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white font-black text-sm shadow">
                GEHC
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase text-[#1B1B1B] truncate">
                  {currentTenant.name}
                </h4>
                <p className="text-[10px] text-[#8C8880] truncate font-mono">
                  {currentTenant.domain}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links — dikelompokkan per bagian */}
          <nav className="space-y-1.5">
            {navWithHeaders.map((row) => {
              if (row.type === 'header') {
                return (
                  <span
                    key={`h-${row.label}`}
                    className="block px-3 pt-4 pb-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#FF416C]/70"
                  >
                    {row.label}
                  </span>
                );
              }
              const item = row.item;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isAllowed = item.roles.includes(currentRole);

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#181818] text-white shadow-md'
                      : !isAllowed
                      ? 'text-[#8C8880]/60 hover:bg-gray-50'
                      : 'text-[#1B1B1B] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#FF416C]' : isAllowed ? 'text-[#8C8880]' : 'text-gray-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && !isAllowed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-bold shrink-0">
                      Locked
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Active Role */}
        <div className="pt-4 border-t border-[#D9D7D0]/60 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full bg-gray-100 border border-[#D9D7D0]"
            />
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-[#1B1B1B] truncate">{currentUser.name}</h5>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-[#FF416C] uppercase tracking-wider">
                  {currentRole}
                </span>
              </div>
            </div>
          </div>

          {/* Account Switcher — POV tiap role (demo/staging) */}
          {(demoMode || authUser) && <PortalAccountSwitcher />}

          {/* Login akun Google lain (kecuali sudah sesi Google) */}
          {ssoClientId && sessionSource !== 'google' && (
            <details className="rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] overflow-hidden">
              <summary className="px-3 py-2.5 text-xs font-bold cursor-pointer select-none hover:bg-white">
                ＋ Login akun Google
              </summary>
              <div className="p-3 flex justify-center">
                <GoogleLoginButton
                  clientId={ssoClientId}
                  onCredential={() => window.location.reload()}
                  onError={(m: string) =>
                    addToast({ type: 'error', title: 'Login Google Gagal', description: m })
                  }
                />
              </div>
            </details>
          )}

          <button
            onClick={() => {
              setActiveView('public');
              addToast({
                type: 'info',
                title: 'Sesi Selesai',
                description: 'Anda telah kembali ke halaman publik.',
              });
            }}
            className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#1B1B1B] transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        
        {/* Render Active View */}
        {activeTab === 'dashboard' && <PortalDashboard onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'content-weekly' && <ManageWeeklyInfo />}
        {activeTab === 'content-activities' && <ManageActivities />}
        {activeTab === 'media-guide' && <MediaGuidePanel />}
        {activeTab === 'groups-monitoring' && <ManageGroupsMonitoring />}
        {activeTab === 'jethro' && <JethroEngine />}
        {activeTab === 'people' && <PeopleInvites />}
        {activeTab === 'waitlist' && <WaitlistBoard />}
        {activeTab === 'struktur' && <ManageStruktur />}
        {activeTab === 'events' && <EventWorkspacePanel />}
        {activeTab === 'users-rbac' && <ManageUsersRBAC />}
        {activeTab === 'integrations' && <ManageIntegrations />}
      </main>

    </div>
  );
};
