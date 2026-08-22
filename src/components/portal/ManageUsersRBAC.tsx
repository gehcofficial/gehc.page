import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import {
  ShieldAlert,
  Shield,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';

export const ManageUsersRBAC: React.FC = () => {
  const {
    allUsers,
    isSuperAdmin,
    currentRole,
    currentUser,
    groups,
    updateUserRole,
    addUser,
    deleteUser,
    tenants,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    tenant_id: string;
    assignedGroupId?: string;
  }>({
    name: '',
    email: '',
    role: 'MENTI',
    tenant_id: 'tenant-youth',
    assignedGroupId: '',
  });

  // 403 Forbidden Gatekeeper check
  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-[32px] p-8 sm:p-16 border border-red-200 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <Lock className="w-8 h-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">
          HTTP 403 • Akses Ditolak
        </span>
        <h3 className="text-2xl font-bold text-[#1B1B1B] mt-2 mb-3">
          Hak Akses Khusus SUPERADMIN
        </h3>
        <p className="text-xs sm:text-sm text-[#8C8880] leading-relaxed max-w-md mx-auto">
          Halaman manajemen pengguna & matrix RBAC ini hanya dapat diakses oleh Superadmin GEHC.
          Peran aktif Anda saat ini adalah <strong className="text-[#1B1B1B] uppercase">[{currentRole}]</strong>.
        </p>
        <p className="text-[11px] text-[#8C8880] mt-4">
          Tip: Gunakan menu Role Switcher di bar atas untuk beralih ke akun <strong>Pnt. Michael Sengkey (SUPERADMIN)</strong> untuk menguji fitur ini.
        </p>
      </div>
    );
  }

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.roles.some((tr) => tr.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'MENTOR',
      tenant_id: 'tenant-youth',
      assignedGroupId: groups[0]?.id || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    const youthRole = user.roles.find((tr) => tr.tenantId === 'tenant-youth') || user.roles[0];
    setFormData({
      name: user.name,
      email: user.email,
      role: youthRole?.role || 'MENTI',
      tenant_id: youthRole?.tenantId || 'tenant-youth',
      assignedGroupId: youthRole?.groupId || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    if (editingUser) {
      updateUserRole(
        editingUser.id,
        formData.tenant_id,
        formData.role,
        formData.role === 'MENTOR' ? formData.assignedGroupId : undefined
      );
    } else {
      addUser({
        email: formData.email,
        name: formData.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name)}`,
        roles: [
          {
            tenantId: formData.tenant_id,
            role: formData.role,
            groupId: formData.role === 'MENTOR' ? formData.assignedGroupId : undefined,
          },
        ],
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Bar */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              RBAC Matrix Management (Superadmin Only)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Kelola Pengguna & Hak Akses
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Atur peran SUPERADMIN, COMMITTEE, MENTOR, dan MENTI per tenant dan kelompok binaan.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Daftarkan Pengguna Baru</span>
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
        
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input
              type="text"
              placeholder="Cari nama, email, atau role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <span className="text-xs font-semibold text-[#8C8880] hidden sm:inline">
            Total {filteredUsers.length} Pengguna
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Nama & Email</th>
                <th className="pb-3">Peran Tenant Youth</th>
                <th className="pb-3">Penugasan Kelompok (Mentor)</th>
                <th className="pb-3 pr-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D7D0]/30">
              {filteredUsers.map((u) => {
                const youthRole = u.roles.find((tr) => tr.tenantId === 'tenant-youth');
                const assignedGroup = groups.find((g) => g.id === youthRole?.groupId);

                return (
                  <tr key={u.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-9 h-9 rounded-full bg-gray-100 border border-[#D9D7D0]"
                        />
                        <div>
                          <h4 className="font-bold text-[#1B1B1B] text-sm flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.id === currentUser.id && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-black text-white font-normal">
                                (Anda)
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-[#8C8880]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          youthRole?.role === 'SUPERADMIN'
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : youthRole?.role === 'COMMITTEE'
                            ? 'bg-pink-100 text-pink-900 border border-pink-200'
                            : youthRole?.role === 'MENTOR'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {youthRole?.role || 'NO ACCESS'}
                      </span>
                    </td>
                    <td className="py-4">
                      {assignedGroup ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: assignedGroup.color }}
                          ></span>
                          <span className="font-semibold text-[#1B1B1B]">
                            Kelompok {assignedGroup.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#8C8880] italic">-</span>
                      )}
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1B1B1B] transition-colors"
                          title="Edit Hak Akses"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => {
                              if (confirm(`Hapus pengguna "${u.name}"?`)) {
                                deleteUser(u.id);
                              }
                            }}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-md p-6 sm:p-8 shadow-2xl border border-[#D9D7D0] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-5">
              <h3 className="text-base font-bold text-[#1B1B1B]">
                {editingUser ? 'Ubah Hak Akses Pengguna' : 'Daftarkan Pengguna & Peran'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Email Akun *
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Peran (Role) di Tenant Youth *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold focus:outline-none focus:border-black"
                >
                  <option value="SUPERADMIN">SUPERADMIN (Akses Penuh Semua Tenant & Database)</option>
                  <option value="COMMITTEE">COMMITTEE (Pengurus Komisi - CMS & All Groups)</option>
                  <option value="MENTOR">MENTOR (Pendamping Kelompok Khusus)</option>
                  <option value="MENTI">MENTI (Anggota Terdaftar / Jemaat Pemuda)</option>
                </select>
              </div>

              {formData.role === 'MENTOR' && (
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                    Tugaskan Ke Kelompok Khusus (Group Scoping)
                  </label>
                  <select
                    value={formData.assignedGroupId}
                    onChange={(e) => setFormData({ ...formData, assignedGroupId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold focus:outline-none focus:border-black"
                  >
                    <option value="">Pilih Kelompok...</option>
                    {groups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        Kelompok {grp.name} ({grp.meaning})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#8C8880] mt-1">
                    Mentor hanya akan dapat menginput dan memantau kelompok yang ditugaskan di sini.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-[#D9D7D0]/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold"
                >
                  Simpan Peran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
