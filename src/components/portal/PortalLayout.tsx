import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GehcLogo } from '../brand/GehcLogo';
import { PortalDashboard } from './PortalDashboard';
import { ManageWeeklyInfo } from './ManageWeeklyInfo';
import { ManageActivities } from './ManageActivities';
import { ManageTestimonials } from './ManageTestimonials';
import { ManageGroupsMonitoring } from './ManageGroupsMonitoring';
import { PastoralCareBoard } from './PastoralCareBoard';
import { BeyondersLeadersPanel } from './BeyondersLeadersPanel';
import { ManageStruktur } from './ManageStruktur';
import { ManageIntegrations } from './ManageIntegrations';
import { MediaGuidePanel } from './MediaGuidePanel';
import { EventWorkspacePanel } from './EventWorkspacePanel';
import { DivisionWorkspacePanel } from './DivisionWorkspacePanel';
import { MenteeKesaksianPanel } from './MenteeKesaksianPanel';
import { WhatsAppChannelsPanel } from './WhatsAppChannelsPanel';
import { JethroEngine } from './JethroEngine';
import { PortalAccountSwitcher } from './PortalAccountSwitcher';
import { displayAvatar } from '../../lib/avatar';
import NotificationPermissionBanner from '../pwa/NotificationPermissionBanner';
import PWASettingsPanel from '../pwa/PWASettingsPanel';
import { PeopleInvites } from './PeopleInvites';
import { WaitingPoolPanel } from './WaitingPoolPanel';
import { JethroPlacementReview } from './JethroPlacementReview';
import { YouthGEHCList } from './YouthGEHCList';
import { OrgHierarchyPanel } from './OrgHierarchyPanel';
import { CatalogReviewPanel } from './CatalogReviewPanel';
import { type ProfileSectionId } from './MyProfilePanel';
import { OnboardingBanner } from './OnboardingBanner';
import { ProfileIncompleteBanner } from './ProfileIncompleteBanner';
import { MustChangePasswordGate } from './MustChangePasswordGate';
import { InvitedWelcomeModal } from './InvitedWelcomeModal';
import { EventInfoPanel } from './EventInfoPanel';
import { RolePickerScreen } from './RolePickerScreen';
import { AccountHub } from './AccountHub';
import {
  parsePortalHash,
  parseHashSearch,
  buildPortalPath,
  roleToNamespace,
  defaultPageForRole,
  isPortalHash,
  type AccountSection,
} from '../../lib/portal-routes';
import { buildPortalNavItems } from '../../lib/portal-nav-config';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  User,
  Users,
  ShieldCheck,
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
  Network,
  MessageSquareQuote,
  MessageCircle,
  GraduationCap,
  CircleHelp,
  HeartHandshake,
  Crown,
} from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { portalNavGroup, portalNavLabel } from '../../lib/portal-i18n';
import { PortalHelpDrawer } from './PortalHelpDrawer';
import { PanelGuide } from './PanelGuide';
import { LanguageToggle } from '../public/ui/LanguageToggle';

const SIDEBAR_COLLAPSED_KEY = 'gehc_sidebar_collapsed';

export const PortalLayout: React.FC = () => {
  const {
    currentTenant,
    currentUser,
    currentRole,
    isGroupMentor,
    isMentee,
    isBodTimkerja,
    setActiveView,
    addToast,
    authUser,
    myRoleOptions,
    setActiveUserRole,
  } = useApp();
  const { t, lang } = useLang();

  const isOnboarding = authUser?.onboardingStatus === 'WAITING_POOL';

  const portalRoute = parsePortalHash(typeof window !== 'undefined' ? window.location.hash : '');
  const isAccountRoute = portalRoute?.namespace === 'account';
  const showRolePicker = portalRoute?.namespace === null && myRoleOptions.length > 1;

  const initialTab = () => {
    if (isAccountRoute) return 'account';
    const page = portalRoute?.page;
    if (page && page !== 'home') return page === 'my-profile' ? 'account' : page;
    return isOnboarding ? 'event-info' : 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [accountSection, setAccountSection] = useState<AccountSection>(
    portalRoute?.accountSection || 'profile',
  );
  const [profileSection, setProfileSection] = useState<ProfileSectionId | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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

  useEffect(() => {
    const syncFromHash = () => {
      if (!isPortalHash(window.location.hash)) return;
      const route = parsePortalHash(window.location.hash);
      if (!route) return;
      if (route.namespace === 'account') {
        setActiveTab('account');
        setAccountSection(route.accountSection || 'profile');
        const section = parseHashSearch(window.location.hash).get('section') as ProfileSectionId | null;
        if (section === 'contact' || section === 'life' || section === 'gifts' || section === 'recreational' || section === 'emergency') {
          setProfileSection(section);
        }
        return;
      }
      if (!route.namespace) return;
      const page = route.page === 'home' ? defaultPageForRole(currentRole, isOnboarding) : route.page;
      if (page === 'my-profile') {
        setActiveTab('account');
        window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1);
        return;
      }
      setActiveTab(page);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [authUser?.id, isOnboarding, currentRole]);

  useEffect(() => {
    if (isOnboarding && activeTab !== 'my-profile' && activeTab !== 'event-info' && activeTab !== 'account') {
      setActiveTab('event-info');
    }
  }, [isOnboarding, authUser?.id]);

  useEffect(() => {
    if (!authUser || isOnboarding || myRoleOptions.length !== 1) return;
    const route = parsePortalHash(window.location.hash);
    if (route?.namespace === null) {
      const role = myRoleOptions[0];
      window.location.hash = buildPortalPath({
        namespace: roleToNamespace(role),
        page: defaultPageForRole(role, false),
      }).slice(1);
    }
  }, [authUser?.id, myRoleOptions.length, isOnboarding]);

  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    account: User,
    'event-info': Calendar,
    dashboard: LayoutDashboard,
    people: UsersRound,
    onboarding: ClipboardList,
    'jethro-placement': Sparkles,
    'youth-gehc': Users,
    catalog: GraduationCap,
    'org-hierarchy': Network,
    'groups-monitoring': Users,
    'beyonders-leaders': Crown,
    'pastoral-care': HeartHandshake,
    jethro: Sparkles,
    'content-weekly': BookOpen,
    'content-activities': Calendar,
    'content-testimonials': MessageSquareQuote,
    kesaksian: MessageSquareQuote,
    'media-guide': Images,
    struktur: ShieldCheck,
    events: Calendar,
    divisions: Users,
    'wa-channels': MessageCircle,
    integrations: FolderSync,
    'pwa-settings': Bell,
  };

  const navItemDefs = buildPortalNavItems(currentRole, { isGroupMentor, isMentee, isBodTimkerja }, isOnboarding);
  const navItems = navItemDefs.map((item) => ({
    ...item,
    icon: NAV_ICONS[item.id] || LayoutDashboard,
  }));

  const isTabAllowed = (tabId: string) => navItems.some((item) => item.id === tabId);

  useEffect(() => {
    if (!isTabAllowed(activeTab) && activeTab !== 'account') {
      setActiveTab(navItems[0]?.id || 'dashboard');
    }
  }, [currentRole]);

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
    if (!isTabAllowed(tabId) && tabId !== 'account') {
      addToast({ type: 'error', title: t.portal.common.accessDeniedTitle, description: t.portal.common.accessDeniedBody });
      return;
    }
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    setHoveredItem(null);
    if (tabId === 'account') {
      setAccountSection('profile');
      window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1);
      return;
    }
    const ns = roleToNamespace(currentRole);
    window.location.hash = buildPortalPath({ namespace: ns, page: tabId }).slice(1);
  };

  if (showRolePicker && !isOnboarding) {
    return <RolePickerScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col md:flex-row text-[#1B1B1B]">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#D9D7D0] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <GehcLogo size={32} />
          <div>
            <h4 className="text-xs font-bold leading-tight">{t.portal.layout.userPortal}</h4>
            <span className="text-[10px] text-[#8C8880]">{currentTenant.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle variant="light" />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-gray-100 text-[#1B1B1B]"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
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
                <GehcLogo
                  size={collapsed ? 40 : 36}
                  rounded="xl"
                  fallbackLabel={collapsed ? 'GE' : 'GEHC'}
                  className="shadow-md shadow-[#FF416C]/20 group-hover:shadow-lg group-hover:shadow-[#FF416C]/30 group-hover:scale-105 transition-all duration-200"
                />
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
                  title={t.portal.layout.collapseSidebar}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}

              {/* Notification Bell */}
              {!collapsed && (
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-[#8C8880] hover:bg-white hover:text-[#1B1B1B] hover:shadow-sm transition-all duration-200 shrink-0"
                  title={t.portal.layout.notifications}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF416C] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
              {!collapsed && (
                <button
                  onClick={() => setShowHelp(true)}
                  className="p-2 rounded-lg text-[#8C8880] hover:bg-white hover:text-[#1B1B1B] hover:shadow-sm transition-all duration-200 shrink-0"
                  title={t.portal.layout.openHelp}
                >
                  <CircleHelp className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Collapsed toggle — connected pill shape */}
            {collapsed && (
              <div className="flex justify-center mt-1">
                <button
                  onClick={() => setCollapsed(false)}
                  className="relative p-2 rounded-xl bg-white border border-[#D9D7D0]/60 text-[#8C8880] hover:text-[#FF416C] hover:border-[#FF416C]/30 hover:shadow-md hover:shadow-[#FF416C]/10 transition-all duration-200"
                  title={t.portal.layout.expandSidebar}
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
                    {portalNavGroup(t, row.label)}
                  </span>
                );
              }
              const item = row.item;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isAllowed = true;

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
                            <span className="text-[13px] font-semibold truncate">{portalNavLabel(t, item.id, { isGroupMentor, isMentee })}</span>
                          </div>
                          {item.badge && !isAllowed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 font-bold shrink-0">
                              {t.portal.common.locked}
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
                    <span className="truncate text-[13px]">{portalNavLabel(t, item.id, { isGroupMentor, isMentee })}</span>
                  </div>

                  {item.badge && !isAllowed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 font-bold shrink-0">
                      {t.portal.common.locked}
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
                    src={displayAvatar(currentUser.name, currentUser.avatar)}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-full bg-gray-100 border-2 border-[#D9D7D0]/60 hover:border-[#FF416C]/40 transition-all duration-200"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#FAF9F5]" />
                </div>

                <button
                  onClick={() => {
                    setActiveView('public');
                    addToast({ type: 'info', title: t.portal.common.sessionDoneTitle, description: t.portal.common.sessionDoneBody });
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
                    <img src={displayAvatar(currentUser.name, currentUser.avatar)} alt={currentUser.name} className="w-10 h-10 rounded-full bg-gray-100 border border-[#D9D7D0]" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-[#1B1B1B] truncate leading-tight">{currentUser.name}</h5>
                    <span className="text-[10px] font-bold text-[#FF416C] uppercase tracking-wider">{currentRole}</span>
                  </div>
                </div>

                {authUser && <PortalAccountSwitcher />}

                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">EN / ID</span>
                  <LanguageToggle variant="light" />
                </div>

                <button
                  onClick={() => {
                    setActiveView('public');
                    addToast({ type: 'info', title: t.portal.common.sessionDoneTitle, description: t.portal.common.sessionDoneBody });
                  }}
                  className="w-full py-2.5 rounded-xl bg-gray-100/80 hover:bg-red-50 text-xs font-bold text-[#8C8880] hover:text-red-500 transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.portal.common.logoutPortal}</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div className="fixed top-16 right-4 z-50 w-80 bg-white rounded-2xl border border-[#D9D7D0] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#D9D7D0]">
              <h3 className="text-sm font-bold text-[#1B1B1B]">{t.portal.layout.notifications}</h3>
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
                  {t.portal.layout.noNotifications}
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
                      setShowNotifications(false);
                      const href = typeof n.payload?.href === 'string' ? n.payload.href : '';
                      if (href) {
                        window.location.hash = href.replace(/^#/, '');
                      }
                    }}
                  >
                    <p className="text-xs font-bold text-[#1B1B1B]">{n.title}</p>
                    <p className="text-[10px] text-[#8C8880] mt-0.5">{n.message}</p>
                    <p className="text-[9px] text-[#D9D7D0] mt-1">
                      {new Date(n.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID')}
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
                  {t.portal.common.markAllRead}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
          <MustChangePasswordGate />
          <InvitedWelcomeModal />
          <NotificationPermissionBanner compact onDismiss={() => {}} />
          {isOnboarding && (
            <OnboardingBanner
              hideEventCard={activeTab === 'event-info'}
              onCompleteProfile={() => {
                setProfileSection('contact');
                setActiveTab('account');
                setAccountSection('profile');
                window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1);
              }}
              onStartGiftTest={() => {
                setProfileSection('gifts');
                setActiveTab('account');
                setAccountSection('profile');
                window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1);
              }}
            />
          )}
          {!isOnboarding && (
            <ProfileIncompleteBanner
              onCompleteProfile={() => {
                setProfileSection('contact');
                setActiveTab('account');
                setAccountSection('profile');
                window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1);
              }}
            />
          )}
          {(activeTab === 'account' || isAccountRoute) && (
            <AccountHub
              section={accountSection}
              profileSection={profileSection}
              onSectionChange={setAccountSection}
            />
          )}
          {activeTab === 'event-info' && (
            <div className="space-y-4">
              <PanelGuide guideId="event-info" />
              <EventInfoPanel />
            </div>
          )}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <PanelGuide guideId="dashboard" />
              <PortalDashboard onNavigate={(tab) => setActiveTab(tab)} />
            </div>
          )}
          {activeTab === 'content-weekly' && (
            <div className="space-y-4">
              <PanelGuide guideId="content-weekly" />
              <ManageWeeklyInfo />
            </div>
          )}
          {activeTab === 'content-activities' && (
            <div className="space-y-4">
              <PanelGuide guideId="content-activities" />
              <ManageActivities />
            </div>
          )}
          {activeTab === 'content-testimonials' && (
            <div className="space-y-4">
              <PanelGuide guideId="content-testimonials" />
              <ManageTestimonials />
            </div>
          )}
          {activeTab === 'kesaksian' && <MenteeKesaksianPanel />}
          {activeTab === 'media-guide' && (
            <div className="space-y-4">
              <PanelGuide guideId="media-guide" />
              <MediaGuidePanel />
            </div>
          )}
          {activeTab === 'jethro' && (
            <div className="space-y-4">
              <PanelGuide guideId="jethro" />
              <JethroEngine />
            </div>
          )}
          {activeTab === 'jethro-placement' && (
            <div className="space-y-4">
              <PanelGuide guideId="jethro-placement" />
              <JethroPlacementReview />
            </div>
          )}
          {activeTab === 'youth-gehc' && (
            <div className="space-y-4">
              <PanelGuide guideId="youth-gehc" />
              <YouthGEHCList />
            </div>
          )}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <PanelGuide guideId="catalog" />
              <CatalogReviewPanel />
            </div>
          )}
          {activeTab === 'org-hierarchy' && (
            <div className="space-y-4">
              <PanelGuide guideId="org-hierarchy" />
              <OrgHierarchyPanel />
            </div>
          )}
          {activeTab === 'struktur' && (
            <div className="space-y-4">
              <PanelGuide guideId="struktur" />
              <ManageStruktur />
            </div>
          )}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <PanelGuide guideId="integrations" />
              <ManageIntegrations />
            </div>
          )}
          {activeTab === 'groups-monitoring' && <ManageGroupsMonitoring />}
          {activeTab === 'beyonders-leaders' && (
            <div className="space-y-4">
              <PanelGuide guideId="beyonders-leaders" />
              <BeyondersLeadersPanel />
            </div>
          )}
          {activeTab === 'pastoral-care' && (
            <div className="space-y-4">
              <PanelGuide guideId="pastoral-care" />
              <PastoralCareBoard />
            </div>
          )}
          {activeTab === 'people' && <PeopleInvites onNavigate={handleNavClick} />}
          {activeTab === 'onboarding' && <WaitingPoolPanel onNavigate={handleNavClick} />}
          {activeTab === 'events' && <EventWorkspacePanel />}
          {activeTab === 'divisions' && <DivisionWorkspacePanel />}
          {activeTab === 'wa-channels' && <WhatsAppChannelsPanel />}
          {activeTab === 'pwa-settings' && <PWASettingsPanel onClose={() => setActiveTab('dashboard')} />}
          {!isTabAllowed(activeTab) && activeTab !== 'account' && (
            <div className="py-20 text-center text-sm text-[#8C8880]">{t.portal.common.tabUnavailable}</div>
          )}
        </main>
      </div>
      <PortalHelpDrawer
        open={showHelp}
        onClose={() => setShowHelp(false)}
        navItems={navItemDefs}
        isGroupMentor={isGroupMentor}
        isMentee={isMentee}
        onNavigate={handleNavClick}
      />
    </div>
  );
};
