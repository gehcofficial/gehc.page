import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, UserCog, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ROLE_PRECEDENCE, sortRoles } from '../../lib/roles';
import { UserRole } from '../../types';

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

/**
 * Account Switcher di sidebar portal — pindah akun/persona tanpa keluar portal,
 * sehingga POV tiap role (menu sidebar, hak akses) langsung terlihat.
 *
 * Aturan:
 * - Mode demo staging : semua akun bisa dipilih (impersonate server aktif).
 * - Sesi Google asli  : hanya chips konteks peran milik sendiri.
 */
export const PortalAccountSwitcher: React.FC = () => {
  const {
    currentUser,
    allUsers,
    setCurrentUserById,
    myRoleOptions,
    setActiveUserRole,
    currentRole,
    sessionSource,
    ssoClientId,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const canBrowseOthers = sessionSource !== 'google';

  // Kelompokkan akun berdasarkan role tertinggi masing-masing
  const grouped = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const filtered = allUsers.filter(
      (u) =>
        !ql ||
        u.name.toLowerCase().includes(ql) ||
        u.email.toLowerCase().includes(ql)
    );
    const map = new Map<UserRole, typeof filtered>();
    for (const u of filtered) {
      const top = sortRoles(u.roles)[0]?.role ?? ('MENTEE' as UserRole);
      if (!map.has(top)) map.set(top, []);
      map.get(top)!.push(u);
    }
    return [...map.entries()].sort(
      ([a], [b]) => ROLE_PRECEDENCE[a] - ROLE_PRECEDENCE[b]
    );
  }, [allUsers, q]);

  return (
    <div className="pt-4 border-t border-[#D9D7D0]/60 space-y-3">
      {/* Konteks peran untuk akun rangkap */}
      {myRoleOptions.length > 1 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1.5">
            Konteks Peran Aktif
          </p>
          <div className="flex flex-wrap gap-1">
            {myRoleOptions.map((role, idx) => (
              <button
                key={`${role}-${idx}`}
                onClick={() => setActiveUserRole(role)}
                title={role}
                className={`text-[9px] font-extrabold px-2 py-1 rounded-full uppercase transition-all ${
                  role === currentRole ? 'ring-2 ring-[#FF416C]' : ''
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Switch akun */}
      <div>
        <button
          onClick={() => setOpen(!open)}
          disabled={!canBrowseOthers}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#FAF9F5] hover:bg-white border border-[#D9D7D0] text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            canBrowseOthers
              ? 'Pindah akun untuk melihat POV role lain'
              : 'Sesi Google asli aktif — gunakan konteks peran di atas bila tersedia'
          }
        >
          <span className="flex items-center gap-2 text-[#1B1B1B]">
            <UserCog className="w-4 h-4 text-[#FF416C]" />
            Ganti Akun
          </span>
          {open ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {open && canBrowseOthers && (
          <div className="mt-2 rounded-2xl bg-white border border-[#D9D7D0] shadow-lg overflow-hidden">
            {/* Pencarian */}
            <div className="p-2 border-b border-[#D9D7D0]/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8880]" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Cari nama atau email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Daftar dikelompokkan per role */}
            <div className="max-h-72 overflow-y-auto">
              {grouped.map(([role, users]) => (
                <div key={role}>
                  <p className="sticky top-0 bg-[#F3F1EC] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#8C8880] flex items-center justify-between">
                    {role}
                    <span>{users.length}</span>
                  </p>
                  {users.map((u) => {
                    const active = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          setCurrentUserById(u.id);
                          setOpen(false);
                          setQ('');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          active ? 'bg-[#181818] text-white' : 'hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <img
                          src={u.avatar || initialsAvatar(u.name)}
                          alt={u.name}
                          loading="lazy"
                          decoding="async"
                          className={`w-7 h-7 rounded-full object-cover shrink-0 border ${
                            active ? 'border-white/40' : 'border-[#D9D7D0]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-[#1B1B1B]'}`}>
                            {u.name}
                            {active && <Check className="inline w-3 h-3 ml-1.5 text-emerald-400" />}
                          </p>
                          <p className={`text-[10px] truncate ${active ? 'text-white/50' : 'text-[#8C8880]'}`}>
                            {u.email}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {grouped.length === 0 && (
                <p className="p-4 text-xs text-[#8C8880] text-center">Tidak ada akun cocok.</p>
              )}
            </div>

            {!ssoClientId && (
              <p className="px-3 py-2 text-[10px] text-[#8C8880] bg-[#FAF9F5] border-t border-[#D9D7D0]/60 leading-relaxed">
                Mode demo — perpindahan akun juga mengganti sesi server (impersonate),
                sehingga hak akses nyata langsung terasa di semua modul.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
