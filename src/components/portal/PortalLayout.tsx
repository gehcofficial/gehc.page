import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PortalDashboard } from './PortalDashboard';
import { ManageWeeklyInfo } from './ManageWeeklyInfo';
import { ManageActivities } from './ManageActivities';
import { ManageGroupsMonitoring } from './ManageGroupsMonitoring';
import { ManageStruktur } from './ManageStruktur';
import { ManageUsersRBAC } from './ManageUsersRBAC';
import { ManageIntegrations } from './ManageIntegrations';
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
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Ringkasan',
      icon: LayoutDashboard,
      roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTI'],
    },
    {
      id: 'content-weekly',
      label: 'Kelola Warta Pemuda',
      icon: BookOpen,
      roles: ['SUPERADMIN', 'COMMITTEE'],
    },
    {
      id: 'content-activities',
      label: 'Kelola Agenda Kegiatan',
      icon: Calendar,
      roles: ['SUPERADMIN', 'COMMITTEE'],
    },
    {
      id: 'groups-monitoring',
      label: isMentor ? 'Monitoring Kelompok Binaan' : 'Monitoring 10 Kelompok',
      icon: Users,
      roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTI'],
    },
    {
      id: 'struktur',
      label: 'Kelola Struktur Komisi',
      icon: ShieldCheck,
      roles: ['SUPERADMIN', 'COMMITTEE'],
    },
    {
      id: 'users-rbac',
      label: 'Pengguna & Matrix RBAC',
      icon: ShieldAlert,
      roles: ['SUPERADMIN'],
      badge: 'Superadmin Only',
    },
    {
      id: 'integrations',
      label: 'Integrasi Google Drive',
      icon: FolderSync,
      roles: ['SUPERADMIN'],
      badge: 'Superadmin Only',
    },
  ];

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

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider block px-3 mb-2">
              Modul Portal
            </span>
            {navItems.map((item) => {
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
        {activeTab === 'groups-monitoring' && <ManageGroupsMonitoring />}
        {activeTab === 'struktur' && <ManageStruktur />}
        {activeTab === 'users-rbac' && <ManageUsersRBAC />}
        {activeTab === 'integrations' && <ManageIntegrations />}
      </main>

    </div>
  );
};
