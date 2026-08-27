import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { LanguageToggle } from '../public/ui/LanguageToggle';
import {
  Layers,
  Shield,
  UserCheck,
  ChevronDown,
  Sparkles,
  ArrowRight,
  RefreshCw,
  LayoutDashboard,
  Globe,
  Menu,
  X,
  Users,
  LogOut,
  LogIn,
  Store,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    publicTab,
    setPublicTab,
    currentTenant,
    switchTenant,
    currentUser,
    currentRole,
    allUsers,
    setCurrentUserById,
    groups,
    resetAllData,
    authUser,
    ssoClientId,
    loginWithCredential,
    logoutSso,
    addToast,
    demoMode,
    sessionSource,
    myRoleOptions,
    setActiveUserRole,
  } = useApp();
  const { t } = useLang();

    const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return 'bg-gradient-to-r from-red-600 to-amber-600 text-white';
      case 'BPMJ':
        return 'bg-gradient-to-r from-stone-500 to-yellow-700 text-white';
      case 'KOMISI':
        return 'bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white';
      case 'COMMITTEE':
        return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white';
      case 'MENTOR':
        return 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white';
      case 'CO_MENTOR':
        return 'bg-gradient-to-r from-sky-600 to-blue-700 text-white';
      case 'MENTEE':
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white';
      case 'ALUMNI':
        return 'bg-gradient-to-r from-zinc-600 to-gray-700 text-white';
      default:
        return 'bg-gray-700 text-white';
    }
  };

  return (
    <>
      <header className="fixed top-[18px] left-0 right-0 z-50 flex items-center justify-center px-4 w-full pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[1120px] flex items-center justify-between bg-[#151515]/95 backdrop-blur-2xl rounded-full px-3 py-2 shadow-2xl border border-white/15 h-[58px] transition-all duration-300">
          
          {/* Brand & Tenant Indicator */}
          <div className="flex items-center gap-3 pl-1">
            <button
              onClick={() => {
                setActiveView('public');
                setPublicTab('beyonders');
              }}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shadow-lg border border-white/30 shrink-0 group-hover:scale-105 transition-transform">
                <span className="text-white font-black text-xs tracking-tight">GEHC</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-xs tracking-tight">GMIM EBEN HAEZER</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-[#FAF9F5] uppercase tracking-wider">
                    {currentTenant.slug}
                  </span>
                </div>
                <span className="text-[10px] text-white/50 font-medium leading-none">Beyonders • Youth</span>
              </div>
            </button>
          </div>

          {/* Navigation Links for Public View */}
          {activeView === 'public' ? (
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              {([
                ['beyonders', t.nav.beyonders],
                ['leaders', t.nav.leaders],
                ['events', t.nav.events],
                ['bulletin', t.nav.bulletin],
                ['benzarpreneurship', t.nav.benzarpreneurship],
              ] as const).map(([tabId, label]) => (
                <button
                  key={tabId}
                  onClick={() => setPublicTab(tabId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    publicTab === tabId
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tabId === 'benzarpreneurship' && <Store className="w-3 h-3" />}
                  {label}
                </button>
              ))}
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-white/70 text-xs font-medium bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#FF416C]" />
              <span>User Portal: <strong className="text-white">{currentTenant.name}</strong></span>
            </div>
          )}

          {/* Right Action Area: Role Persona Switcher + Portal/Web View Switcher */}
          <div className="flex items-center gap-2">

            {/* Quick Role Switcher — hanya untuk mode demo / sesi aktif.
                Tamu produksi melihat navbar bersih tanpa alat testing. */}
            {(demoMode || authUser) && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsRoleMenuOpen(!isRoleMenuOpen);
                  }}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all"
                title="Persona & konteks akses"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-white/40">
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${getRoleBadgeStyle(currentRole)}`}>
                  {currentRole}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Persona Switcher Dropdown */}
              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-[#181818] border border-white/15 rounded-3xl p-3 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-2">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#FF416C]" />
                        {demoMode ? 'Persona — Akun Dummy TiDB' : 'Simulasi Persona & RBAC'}
                      </h4>
                      <p className="text-[10px] text-white/50">
                        {demoMode
                          ? 'Akun dari database staging — klik untuk masuk sungguhan'
                          : 'Uji hak akses peran sesuai PRD'}
                      </p>
                    </div>
                    <button
                      onClick={resetAllData}
                      title="Reset Data"
                      className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chips multi-role: ganti konteks akses untuk akun rangkap */}
                  {myRoleOptions.length > 1 && (
                    <div className="px-2 pb-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5">
                        Konteks Akses Aktif
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {myRoleOptions.map((role) => (
                          <button
                            key={role}
                            onClick={() => setActiveUserRole(role)}
                            className={`text-[9px] font-extrabold px-2 py-1 rounded-full uppercase transition-all ${
                              role === currentRole
                                ? getRoleBadgeStyle(role)
                                : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {allUsers.map((user) => {
                      const userRoleMap = user.roles.find((r) => r.tenantId === currentTenant.id) || {
                        role: 'MENTEE' as any,
                      };
                      const userGroupName = userRoleMap.groupId
                        ? groups.find((g) => g.id === userRoleMap.groupId)?.name
                        : null;
                      const isSelected = user.id === currentUser.id;

                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            setCurrentUserById(user.id);
                            setIsRoleMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-2xl text-left transition-all ${
                            isSelected
                              ? 'bg-white/15 border border-white/20'
                              : 'hover:bg-white/5 text-white/80 hover:text-white'
                          }`}
                        >
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover border border-white/30 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white truncate">{user.name}</span>
                              <span
                                className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${getRoleBadgeStyle(
                                  userRoleMap.role
                                )}`}
                              >
                                {userRoleMap.role}
                              </span>
                            </div>
                            <div className="text-[10px] text-white/50 truncate flex items-center gap-1">
                              <span>{user.email}</span>
                              {userGroupName && (
                                <span className="text-cyan-300 font-semibold">• Grup {userGroupName}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Google SSO — sesi nyata dari server (TiDB) */}
                  <div className="border-t border-white/10 mt-2 pt-2 px-1">
                    {authUser && (
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {sessionSource === 'demo' ? 'Sesi Demo Aktif' : 'SSO Google Aktif'}
                          </p>
                          <p className="text-[10px] text-white/50 truncate">{authUser.email}</p>
                        </div>
                        <button
                          onClick={() => {
                            logoutSso();
                            setIsRoleMenuOpen(false);
                          }}
                          title="Logout SSO"
                          className="p-1.5 text-white/60 hover:text-red-300 rounded-lg hover:bg-white/10 shrink-0"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Login Google selalu tersedia (kecuali sudah sesi Google) —
                        bisa dipakai kapan pun meski mode demo aktif */}
                    {ssoClientId && sessionSource !== 'google' && (
                      <>
                        {!authUser && (
                          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1 text-center">
                            Masuk dengan akun Google
                          </p>
                        )}
                        {authUser && (
                          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1 text-center">
                            Masuk dengan akun Google lain
                          </p>
                        )}
                        <GoogleLoginButton
                          clientId={ssoClientId}
                          onCredential={(cred) => {
                            loginWithCredential(cred).catch((err: Error) =>
                              addToast({
                                type: 'error',
                                title: 'Login Google Gagal',
                                description: err.message,
                              })
                            );
                            setIsRoleMenuOpen(false);
                          }}
                        />
                      </>
                    )}
                    {!ssoClientId && !authUser && (
                      <p className="text-[10px] text-white/40 text-center leading-relaxed">
                        Login Google belum aktif — set GOOGLE_CLIENT_ID di server.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Language toggle + Masuk (tamu) + Portal / Public Toggle Button */}
            <LanguageToggle />
            {activeView === 'public' && !authUser && !demoMode && ssoClientId && (
              <button
                onClick={() => setActiveView('portal')}
                title="Masuk ke portal"
                className="px-3 h-[34px] rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>
            )}
            {activeView === 'public' ? (
              <button
                onClick={() => setActiveView('portal')}
                className="bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-90 text-white font-bold rounded-full transition-all duration-300 shrink-0 flex items-center gap-1.5 px-3.5 sm:px-4 text-[10px] sm:text-xs h-[34px] shadow-md uppercase tracking-wider"
              >
                <span>Portal</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => setActiveView('public')}
                className="border border-white/30 hover:bg-white hover:text-black text-white font-bold rounded-full transition-all duration-300 shrink-0 flex items-center gap-1.5 px-3.5 sm:px-4 text-[10px] sm:text-xs h-[34px] uppercase tracking-wider"
              >
                <Globe className="w-3 h-3" />
                <span>Web Publik</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xl md:hidden pt-24 px-6 flex flex-col justify-between pb-8">
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-4">
              <span className="text-xs text-white/50 uppercase font-semibold">Tenant Aktif</span>
              <p className="text-white font-bold text-sm">{currentTenant.name} ({currentTenant.domain})</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('beyonders');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'home' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                {t.nav.beyonders}
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('bulletin');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'weekly-info' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                {t.nav.bulletin}
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('events');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'activity' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                {t.nav.events}
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('beyonders');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'groups' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                {t.nav.beyonders}
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('leaders');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'komisi' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                {t.nav.leaders}
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('benzarpreneurship');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold flex items-center gap-2 ${
                  publicTab === 'benzarpreneurship' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                <Store className="w-4 h-4" />
                {t.nav.benzarpreneurship}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
            <button
              onClick={() => {
                setActiveView(activeView === 'public' ? 'portal' : 'public');
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white font-bold text-center text-sm shadow-xl"
            >
              {activeView === 'public' ? 'Buka Dashboard User Portal' : 'Kembali ke Web Publik'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
