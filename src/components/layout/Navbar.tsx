import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    publicTab,
    setPublicTab,
    currentTenant,
    allTenants,
    switchTenant,
    currentUser,
    currentRole,
    allUsers,
    setCurrentUserById,
    groups,
    resetAllData,
  } = useApp();

  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return 'bg-gradient-to-r from-red-600 to-amber-600 text-white';
      case 'COMMITTEE':
        return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white';
      case 'MENTOR':
        return 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white';
      case 'MENTI':
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white';
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
                setPublicTab('home');
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
                <span className="text-[10px] text-white/50 font-medium leading-none">Cikarang Ecosystem</span>
              </div>
            </button>

            {/* Tenant Selector Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsTenantMenuOpen(!isTenantMenuOpen);
                  setIsRoleMenuOpen(false);
                }}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[11px] font-medium border border-white/10 transition-colors"
                title="Switch Ecosystem Tenant"
              >
                <Layers className="w-3 h-3 text-[#FF416C]" />
                <span className="truncate max-w-[90px]">{currentTenant.name.split(' ')[0]}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Tenant Dropdown */}
              {isTenantMenuOpen && (
                <div className="absolute left-0 mt-3 w-64 bg-[#181818] border border-white/15 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Multi-Tenant Ecosystems
                  </div>
                  {allTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => {
                        switchTenant(tenant.id);
                        setIsTenantMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        currentTenant.id === tenant.id
                          ? 'bg-white/15 text-white font-semibold'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{tenant.name}</span>
                        <span className="text-[10px] text-white/40 font-mono">{tenant.domain}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          tenant.is_active
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                            : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {tenant.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links for Public View */}
          {activeView === 'public' ? (
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <button
                onClick={() => setPublicTab('home')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  publicTab === 'home'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Beranda
              </button>
              <button
                onClick={() => setPublicTab('weekly-info')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  publicTab === 'weekly-info'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Warta Pemuda
              </button>
              <button
                onClick={() => setPublicTab('activity')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  publicTab === 'activity'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Kegiatan
              </button>
              <button
                onClick={() => setPublicTab('groups')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  publicTab === 'groups'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                10 Kelompok
              </button>
              <button
                onClick={() => setPublicTab('struktur')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  publicTab === 'struktur'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Struktur
              </button>
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-white/70 text-xs font-medium bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#FF416C]" />
              <span>User Portal: <strong className="text-white">{currentTenant.name}</strong></span>
            </div>
          )}

          {/* Right Action Area: Role Persona Switcher + Portal/Web View Switcher */}
          <div className="flex items-center gap-2">
            
            {/* Quick Role Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsRoleMenuOpen(!isRoleMenuOpen);
                  setIsTenantMenuOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all text-xs"
                title="Switch User Persona (RBAC Tester)"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden border border-white/40">
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-bold leading-none truncate max-w-[85px] sm:max-w-[110px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className={`text-[8px] font-black px-1 py-0.2 rounded mt-0.5 uppercase ${getRoleBadgeStyle(currentRole)}`}>
                    {currentRole}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </button>

              {/* Persona Switcher Dropdown */}
              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-[#181818] border border-white/15 rounded-3xl p-3 shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-2">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#FF416C]" />
                        Simulasi Persona & RBAC
                      </h4>
                      <p className="text-[10px] text-white/50">Uji hak akses peran sesuai PRD</p>
                    </div>
                    <button
                      onClick={resetAllData}
                      title="Reset Data"
                      className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {allUsers.map((user) => {
                      const userRoleMap = user.roles.find((r) => r.tenantId === currentTenant.id) || {
                        role: 'MENTI' as any,
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
                </div>
              )}
            </div>

            {/* Portal / Public Toggle Button */}
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
                  setPublicTab('home');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'home' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                Beranda
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('weekly-info');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'weekly-info' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                Warta Pemuda
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('activity');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'activity' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                Kegiatan & Agenda
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('groups');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'groups' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                10 Kelompok Pemuda
              </button>
              <button
                onClick={() => {
                  setActiveView('public');
                  setPublicTab('struktur');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-base font-semibold ${
                  publicTab === 'struktur' && activeView === 'public' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                Struktur Pengurus
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
