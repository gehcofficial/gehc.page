import React, { useState, useEffect } from 'react';
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
import { DivisionWorkspacePanel } from './DivisionWorkspacePanel';
import { JethroEngine } from './JethroEngine';
import { PortalAccountSwitcher } from './PortalAccountSwitcher';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { NotificationPermissionBanner, PWASettingsPanel } from '../pwa';
import { WaitlistBoard } from './WaitlistBoard';
import { PeopleInvites } from './PeopleInvites';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  ShieldCheck,
  ShieldAlert,
  FolderSync,
  LogOut,
  Menu,
  X,
  Sparkles,
  UsersRound,
  ClipboardList,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Bell,
} from 'lucide-react';

const SIDEBAR_COLLAPSED_KEY = 'gehc_sidebar_collapsed';

export const PortalLayout: React.FC = () => {
  const {
    currentTenant,
    currentUser,
    currentRole,
    isMentor,
    setActiveView,
    addToast,
    demoMode,
    authUser,
    ssoClientId,
    sessionSource,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const r = await fetch('/api/notifications', { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          setUnreadCount(d.unread || 0);
          setNotifications(d.notifications || []);
        }
      } catch { /* skip */ }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Ringkasan', icon: LayoutDashboard, roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTEE'], group: 'Utama' },
    { id: 'people', label: 'Orang & Undangan', icon: UsersRound, roles: ['SUPERADMIN', 'KOMISI'], group: 'Komunitas' },
    { id: 'waitlist', label: 'Waitlist Newcomer', icon: ClipboardList, roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], group: 'Komunitas' },
    { id: 'groups-monitoring', label: isMentor ? 'Monitoring Kelompok Binaan' : 'Monitoring 10 Kelompok', icon: Users, roles: ['SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTEE'], group: 'Komunitas' },
    { id: 'jethro', label: 'Jethro Engine (Regenerasi)', icon: Sparkles, roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas' },
    { id: 'content-weekly', label: 'Kelola Warta Pemuda', icon: BookOpen, roles: ['SUPERADMIN', 'COMMITTEE'], group: 'Konten' },
    { id: 'content-activities', label: 'Kelola Agenda Kegiatan', icon: Calendar, roles: ['SUPERADMIN', 'COMMITTEE'], group: 'Konten' },
    { id: 'media-guide', label: 'Panduan Media (Drive)', icon: Images, roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], group: 'Konten' },
    { id: 'struktur', label: 'Struktur Organisasi (Org Chart)', icon: ShieldCheck, roles: ['SUPERADMIN', 'COMMITTEE'], group: 'Struktur' },
    { id: 'events', label: 'Program & Event', icon: Calendar, roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], group: 'Kerja' },
    { id: 'divisions', label: 'Panel Divisi (6 Divisi)', icon: Users, roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'], group: 'Kerja' },
    { id: 'users-rbac', label: 'Pengguna & Matrix RBAC', icon: ShieldAlert, roles: ['SUPERADMIN'], badge: 'Superadmin Only', group: 'Sistem' },
    { id: 'integrations', label: 'Integrasi Google Drive', icon: FolderSync, roles: ['SUPERADMIN'], badge: 'Superadmin Only', group: 'Sistem' },
    { id: 'pwa-settings', label: 'PWA & Notifikasi', icon: Bell, roles: ['SUPERADMIN', 'COMMITTEE', 'KOMISI', 'MENTOR', 'MENTEE'], group: 'Sistem' },
  ];

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
    setHoveredItem(null);
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

      <div className="flex flex-1 min-h-screen">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed md:sticky top-0 left-0 z-30 h-screen bg-[#FAF9F5] border-r border-[#D9D7D0]/60 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            collapsed ? 'w-[68px]' : 'w-72'
          } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Zone 1: Header — Logo + Toggle */}
          <div className={`shrink-0 border-b border-[#D9D7D0]/40 ${collapsed ? 'px-2.5 pt-3 pb-2' : 'px-4 pt-4 pb-3'}`}>
            <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between'}`}>
              {/* Logo */}
              <button
                onClick={() => setActiveView('public')}
                className={`flex items-center rounded-xl transition-all duration-200 group ${
                  collapsed
                    ? 'p-2 hover:bg-white hover:shadow-sm'
                    : 'gap-2.5 p-2 -ml-1 flex-1 min-w-0 hover:bg-white hover:shadow-sm'
                }`}
              >
                <div className={`rounded-xl bg-gradient-to-br from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white font-black shadow-md shadow-[#FF416C]/20 shrink-0 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-[#FF416C]/30 group-hover:scale-105 ${
                  collapsed ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs'
                }`}>
                  {collapsed ? 'GE' : 'GEHC'}
                </div>
                {!collapsed && (
                  <div className="min-w-0 text-left">
                    <h4 className="text-[11px] font-black uppercase text-[#1B1B1B] truncate leading-tight">
                      {currentTenant.name}
                    </h4>
                    <p className="text-[9px] text-[#8C8880] truncate font-mono leading-tight">
                      {currentTenant.domain}
                    </p>
                  </div>
                )}
              </button>

              {/* Toggle */}
              {!collapsed && (
                <button
                  onClick={() => setCollapsed(true)}
                  className="p-2 rounded-lg text-[#8C8880] hover:bg-white hover:text-[#1B1B1B] hover:shadow-sm transition-all duration-200 shrink-0"
                  title="Tutup sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}

              {/* Notification Bell */}
              {!collapsed && (
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-[#8C8880] hover:bg-white hover:text-[#1B1B1B] hover:shadow-sm transition-all duration-200 shrink-0"
                  title="Notifikasi"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF416C] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Collapsed toggle — connected pill shape */}
            {collapsed && (
              <div className="flex justify-center mt-1">
                <button
                  onClick={() => setCollapsed(false)}
                  className="relative p-2 rounded-xl bg-white border border-[#D9D7D0]/60 text-[#8C8880] hover:text-[#FF416C] hover:border-[#FF416C]/30 hover:shadow-md hover:shadow-[#FF416C]/10 transition-all duration-200"
                  title="Buka sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Zone 2: Nav Links (scrollable) */}
          <nav className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 ${collapsed ? 'px-2.5 py-2' : 'px-3 py-2'}`}>
            {navWithHeaders.map((row) => {
              if (row.type === 'header') {
                if (collapsed) return null;
                return (
                  <span key={`h-${row.label}`} className="block px-3 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#FF416C]/60">
                    {row.label}
                  </span>
                );
              }
              const item = row.item;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isAllowed = item.roles.includes(currentRole);

              if (collapsed) {
                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {/* Nav button — icon left-aligned */}
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 ${
                        isActive
                          ? 'bg-[#181818] text-white shadow-lg shadow-black/10'
                          : 'text-[#8C8880] hover:bg-white hover:text-[#1B1B1B] hover:shadow-sm'
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-[#FF416C]' : isAllowed ? '' : 'text-gray-400'
                      }`} />
                    </button>

                    {/* Flyout panel — appears on hover */}
                    {hoveredItem === item.id && (
                      <div
                        className="absolute left-full top-0 ml-2 z-50 w-56 py-1.5 bg-white rounded-xl border border-[#D9D7D0]/60 shadow-xl shadow-black/10"
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <div className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-colors ${
                          isActive ? 'bg-[#181818] text-white' : 'hover:bg-[#FAF9F5] text-[#1B1B1B]'
                        }`} onClick={() => handleNavClick(item.id)}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FF416C]' : 'text-[#8C8880]'}`} />
                            <span className="text-[13px] font-semibold truncate">{item.label}</span>
                          </div>
                          {item.badge && !isAllowed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 font-bold shrink-0">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Expanded mode
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 ${
                    isActive
                      ? 'bg-[#181818] text-white shadow-lg shadow-black/10'
                      : isAllowed
                      ? 'text-[#1B1B1B] hover:bg-white hover:shadow-sm'
                      : 'text-[#8C8880]/50 hover:bg-white/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-[#FF416C]' : isAllowed ? 'text-[#8C8880]' : 'text-gray-400'
                    }`} />
                    <span className="truncate text-[13px]">{item.label}</span>
                  </div>

                  {item.badge && !isAllowed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 font-bold shrink-0">
                      Locked
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Bottom — User Card + Logout (fixed) */}
          <div className={`shrink-0 border-t border-[#D9D7D0]/60 ${collapsed ? 'px-2.5 py-3' : 'px-4 py-4'}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-full bg-gray-100 border-2 border-[#D9D7D0]/60 hover:border-[#FF416C]/40 transition-all duration-200"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#FAF9F5]" />
                </div>

                <button
                  onClick={() => {
                    setActiveView('public');
                    addToast({ type: 'info', title: 'Sesi Selesai', description: 'Anda telah kembali ke halaman publik.' });
                  }}
                  className="w-9 h-9 rounded-xl bg-gray-100/80 hover:bg-red-50 flex items-center justify-center text-[#8C8880] hover:text-red-500 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#D9D7D0]/40">
                  <div className="relative shrink-0">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full bg-gray-100 border border-[#D9D7D0]" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-[#1B1B1B] truncate leading-tight">{currentUser.name}</h5>
                    <span className="text-[10px] font-bold text-[#FF416C] uppercase tracking-wider">{currentRole}</span>
                  </div>
                </div>

                {(demoMode || authUser) && <PortalAccountSwitcher />}

                {ssoClientId && sessionSource !== 'google' && (
                  <details className="rounded-xl border border-[#D9D7D0]/60 bg-white overflow-hidden">
                    <summary className="px-3 py-2.5 text-xs font-bold cursor-pointer select-none hover:bg-[#FAF9F5] transition-colors">
                      + Login akun Google
                    </summary>
                    <div className="p-3 flex justify-center">
                      <GoogleLoginButton
                        clientId={ssoClientId}
                        onCredential={() => window.location.reload()}
                        onError={(m: string) => addToast({ type: 'error', title: 'Login Google Gagal', description: m })}
                      />
                    </div>
                  </details>
                )}

                <button
                  onClick={() => {
                    setActiveView('public');
                    addToast({ type: 'info', title: 'Sesi Selesai', description: 'Anda telah kembali ke halaman publik.' });
                  }}
                  className="w-full py-2.5 rounded-xl bg-gray-100/80 hover:bg-red-50 text-xs font-bold text-[#8C8880] hover:text-red-500 transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Portal</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div className="fixed top-16 right-4 z-50 w-80 bg-white rounded-2xl border border-[#D9D7D0] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#D9D7D0]">
              <h3 className="text-sm font-bold text-[#1B1B1B]">Notifikasi</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8C8880]">
                  Tidak ada notifikasi
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className="p-3 border-b border-[#D9D7D0]/50 hover:bg-[#FAF9F5] cursor-pointer"
                    onClick={async () => {
                      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH', credentials: 'include' });
                      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                      setUnreadCount((prev) => Math.max(0, prev - 1));
                    }}
                  >
                    <p className="text-xs font-bold text-[#1B1B1B]">{n.title}</p>
                    <p className="text-[10px] text-[#8C8880] mt-0.5">{n.message}</p>
                    <p className="text-[9px] text-[#D9D7D0] mt-1">
                      {new Date(n.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="p-2 border-t border-[#D9D7D0]">
                <button
                  onClick={async () => {
                    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
                    setNotifications([]);
                    setUnreadCount(0);
                  }}
                  className="w-full py-2 text-[10px] font-semibold text-[#8C8880] hover:bg-gray-100 rounded-lg"
                >
                  Tandai semua sudah dibaca
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
          <NotificationPermissionBanner compact onDismiss={() => {}} />
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
          {activeTab === 'divisions' && <DivisionWorkspacePanel />}
          {activeTab === 'users-rbac' && <ManageUsersRBAC />}
          {activeTab === 'integrations' && <ManageIntegrations />}
          {activeTab === 'pwa-settings' && <PWASettingsPanel onClose={() => setActiveTab('dashboard')} />}
        </main>
      </div>
    </div>
  );
};
