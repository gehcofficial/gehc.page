import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';
import { LanguageToggle } from '../public/ui/LanguageToggle';
import {
  ChevronDown,
  ArrowRight,
  LayoutDashboard,
  Globe,
  Menu,
  X,
  LogOut,
  LogIn,
  Store,
} from 'lucide-react';
import { displayAvatar } from '../../lib/avatar';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    publicTab,
    setPublicTab,
    currentTenant,
    currentUser,
    currentRole,
    authUser,
    logoutSso,
    myRoleOptions,
    setActiveUserRole,
    isPlatformAdmin,
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
          
          {/* Brand */}
          <div className="flex items-center gap-2.5 pl-1 shrink-0 mr-2 sm:mr-5 lg:mr-10 max-w-[11rem] lg:max-w-[12rem]">
            <button
              onClick={() => {
                setActiveView('public');
                setPublicTab('beyonders');
              }}
              className="flex items-center gap-2.5 text-left group min-w-0"
            >
              <GehcLogo
                size={36}
                className="group-hover:scale-105 transition-transform"
              />
              <BrandCaption className="hidden sm:flex" />
            </button>
          </div>

          {/* Navigation Links for Public View */}
          {activeView === 'public' ? (
            <nav className="hidden md:flex items-center gap-1 lg:gap-2 flex-1 justify-center min-w-0 px-1">
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

          {/* Right Action Area */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">

            {authUser && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all"
                  title="Akun & konteks peran"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-white/40">
                    <img src={displayAvatar(currentUser.name, currentUser.avatar)} alt={currentUser.name} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${getRoleBadgeStyle(currentRole)}`}>
                    {currentRole}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {isRoleMenuOpen && (
                  <div className="absolute right-0 mt-3 w-72 bg-[#181818] border border-white/15 rounded-3xl p-3 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 pb-3 border-b border-white/10">
                      <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-white/50 truncate">{authUser.email}</p>
                    </div>

                    {myRoleOptions.length > 1 && (
                      <div className="px-2 py-3 border-b border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5">
                          Konteks Peran
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

                    <div className="pt-2 px-1">
                      <button
                        onClick={() => {
                          logoutSso();
                          setIsRoleMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold text-white/70 hover:text-red-300 hover:bg-white/5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Keluar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block">
              <LanguageToggle />
            </div>

            {activeView === 'public' && !authUser && (
              <>
                <button
                  onClick={() => { window.location.hash = '#/login'; }}
                  title="Masuk ke portal"
                  className="hidden sm:flex px-3 h-[34px] rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold transition-colors items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </button>
                <button
                  onClick={() => { window.location.hash = '#/register'; }}
                  title="Daftar Beyonders"
                  className="px-3 h-[34px] rounded-full bg-white text-[#181818] text-[11px] font-black transition-colors hidden sm:flex items-center gap-1.5"
                >
                  Daftar
                </button>
              </>
            )}

            {activeView === 'public' && authUser ? (
              <div className="flex items-center gap-2">
                {isPlatformAdmin && (
                  <button
                    type="button"
                    onClick={() => { window.location.hash = '#/admin'; }}
                    className="border border-white/30 text-white font-bold rounded-full px-3 text-[10px] h-[34px] uppercase tracking-wider hidden sm:block"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={() => setActiveView('portal')}
                  className="bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-90 text-white font-bold rounded-full transition-all duration-300 shrink-0 flex items-center gap-1.5 px-3.5 sm:px-4 text-[10px] sm:text-xs h-[34px] shadow-md uppercase tracking-wider"
                >
                  <span>Portal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : activeView === 'portal' ? (
              <button
                onClick={() => setActiveView('public')}
                className="border border-white/30 hover:bg-white hover:text-black text-white font-bold rounded-full transition-all duration-300 shrink-0 flex items-center gap-1.5 px-3.5 sm:px-4 text-[10px] sm:text-xs h-[34px] uppercase tracking-wider"
              >
                <Globe className="w-3 h-3" />
                <span>Web Publik</span>
              </button>
            ) : null}

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
            <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 mb-4">
              <div className="min-w-0">
                <span className="text-xs text-white/50 uppercase font-semibold">Tenant Aktif</span>
                <p className="text-white font-bold text-sm truncate">{currentTenant.name} ({currentTenant.domain})</p>
              </div>
              <LanguageToggle />
            </div>

            <div className="flex flex-col gap-2">
              {([
                ['beyonders', t.nav.beyonders],
                ['leaders', t.nav.leaders],
                ['events', t.nav.events],
                ['bulletin', t.nav.bulletin],
                ['benzarpreneurship', t.nav.benzarpreneurship],
              ] as const).map(([tabId, label]) => (
                <button
                  key={tabId}
                  onClick={() => {
                    setActiveView('public');
                    setPublicTab(tabId);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold flex items-center gap-2 ${
                    publicTab === tabId && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                  }`}
                >
                  {tabId === 'benzarpreneurship' && <Store className="w-4 h-4" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
            {!authUser && (
              <>
                <button
                  onClick={() => {
                    window.location.hash = '#/register';
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl text-base font-semibold text-white"
                >
                  Daftar Beyonders
                </button>
                <button
                  onClick={() => {
                    window.location.hash = '#/login';
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-2xl text-base font-semibold text-white/80"
                >
                  Masuk
                </button>
              </>
            )}
            {authUser && activeView === 'public' && (
              <button
                onClick={() => {
                  setActiveView('portal');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white font-bold text-center text-sm shadow-xl"
              >
                Buka Portal
              </button>
            )}
            {activeView === 'portal' && (
              <button
                onClick={() => {
                  setActiveView('public');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-3.5 rounded-full border border-white/30 text-white font-bold text-center text-sm"
              >
                Kembali ke Web Publik
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
