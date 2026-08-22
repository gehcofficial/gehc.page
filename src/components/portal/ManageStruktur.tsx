import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StrukturMember } from '../../types';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  X,
  Search,
} from 'lucide-react';

export const ManageStruktur: React.FC = () => {
  const { strukturMembers, addStrukturMember, updateStrukturMember, deleteStrukturMember } =
    useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StrukturMember | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    position: '',
    division: 'Badan Pengurus Harian (BPH)',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
    phone: '',
    email: '',
    bio: '',
    order: 10,
  });

  const handleOpenCreate = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      position: 'Anggota Komisi Pelayanan',
      division: 'Bidang Pembinaan & Pemuridan',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
      phone: '+62 812-xxxx-xxxx',
      email: 'pengurus@gehc.page',
      bio: 'Melayani dengan segenap hati untuk pertumbuhan rohani pemuda GMIM.',
      order: strukturMembers.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: StrukturMember) => {
    setEditingMember(m);
    setFormData({
      name: m.name,
      position: m.position,
      division: m.division,
      photoUrl: m.photoUrl,
      phone: m.phone || '',
      email: m.email || '',
      bio: m.bio || '',
      order: m.order,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.position.trim()) return;

    if (editingMember) {
      updateStrukturMember(editingMember.id, {
        name: formData.name,
        position: formData.position,
        division: formData.division,
        photoUrl: formData.photoUrl,
        phone: formData.phone,
        email: formData.email,
        bio: formData.bio,
        order: Number(formData.order),
      });
    } else {
      addStrukturMember({
        tenant_id: 'tenant-youth',
        name: formData.name,
        position: formData.position,
        division: formData.division,
        photoUrl: formData.photoUrl,
        phone: formData.phone,
        email: formData.email,
        bio: formData.bio,
        order: Number(formData.order),
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Organization Directory CMS
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Kelola Struktur Komisi Pelayanan Pemuda
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Data susunan pengurus Kompelka Pemuda GMIM Eben Haezer Cikarang.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Pengurus</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {strukturMembers.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-[28px] p-5 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-start gap-4 mb-4">
              <img
                src={m.photoUrl}
                alt={m.name}
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-[#D9D7D0]"
              />
              <div className="min-w-0">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold uppercase">
                  {m.division}
                </span>
                <h4 className="text-base font-bold text-[#1B1B1B] mt-1 leading-snug">{m.name}</h4>
                <p className="text-xs font-semibold text-[#FF416C]">{m.position}</p>
              </div>
            </div>

            <p className="text-xs text-[#8C8880] line-clamp-2 mb-4 leading-relaxed">
              {m.bio}
            </p>

            <div className="pt-3 border-t border-[#D9D7D0]/40 flex items-center justify-between">
              <span className="text-[10px] text-[#8C8880] font-mono">Urutan: #{m.order}</span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(m)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-[#1B1B1B]"
                  title="Edit Pengurus"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Hapus pengurus "${m.name}"?`)) {
                      deleteStrukturMember(m.id);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
                  title="Hapus Pengurus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-[#D9D7D0] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-5">
              <h3 className="text-base font-bold text-[#1B1B1B]">
                {editingMember ? 'Edit Pengurus Komisi' : 'Tambah Pengurus Komisi Baru'}
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
                  Nama Lengkap & Gelar *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daniel Lumowa, S.T."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                    Jabatan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ketua Komisi / Sekretaris"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                    Divisi / Bidang
                  </label>
                  <input
                    type="text"
                    placeholder="BPH / Bidang Ibadah"
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  URL Foto Profil
                </label>
                <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                    Nomor Telepon / WA
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Bio Singkat / Visi Pelayanan
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                ></textarea>
              </div>

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
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
