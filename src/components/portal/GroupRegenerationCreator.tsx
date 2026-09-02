import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, RotateCcw, Users, GitBranch } from 'lucide-react';
import { generateChildGroupName, getBaseGroupName, getGenerationNumber } from '../../lib/groupRegeneration';
import ConfirmationModal from '../ui/ConfirmationModal';

interface GroupWithRelations {
  id: string;
  name: string;
  parentGroupId: string | null;
  color?: string;
  meetingSchedule?: string;
  meetingLocation?: string;
  meaning?: string;
  scripture?: string;
  foundedPeriod?: string;
}

type FormState = {
  parentGroupId: string;
  name: string;
  meaning: string;
  scripture: string;
  meetingSchedule: string;
  meetingLocation: string;
  color: string;
  foundedPeriod: string;
};

const emptyForm = (): FormState => ({
  parentGroupId: '',
  name: '',
  meaning: '',
  scripture: '',
  meetingSchedule: '',
  meetingLocation: '',
  color: '#181818',
  foundedPeriod: new Date().toISOString().slice(0, 7),
});

export const GroupRegenerationCreator: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { groups, addGroup, updateGroup, deleteGroup, canAccess } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithRelations | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<string>('');

  const parentGroups = groups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openCreate = (parentId?: string) => {
    setEditingGroup(null);
    setFormData(emptyForm());
    if (parentId) {
      setSelectedParent(parentId);
      const parent = groups.find((g) => g.id === parentId);
      if (parent) {
        const siblings = groups
          .filter((g) => g.parentGroupId === parentId)
          .map((g) => g.name);
        setFormData({ ...emptyForm(), name: generateChildGroupName(parent.name, siblings), foundedPeriod: new Date().toISOString().slice(0, 7) });
      }
    }
    setIsModalOpen(true);
  };

  const openEdit = (g: GroupWithRelations) => {
    setEditingGroup(g);
    setSelectedParent(g.parentGroupId || '');
    setFormData({
      parentGroupId: g.parentGroupId || '',
      name: g.name,
      meaning: g.meaning || '',
      scripture: g.scripture || '',
      meetingSchedule: g.meetingSchedule || '',
      meetingLocation: g.meetingLocation || '',
      color: g.color || '#181818',
      foundedPeriod: g.foundedPeriod || new Date().toISOString().slice(0, 7),
    });
    setIsModalOpen(true);
  };

  const handleParentChange = (parentId: string) => {
    setSelectedParent(parentId);
    setFormData({ ...formData, parentGroupId: parentId });
    if (parentId) {
      const parent = groups.find((g) => g.id === parentId);
      if (parent) {
        const siblings = groups
          .filter((g) => g.parentGroupId === parentId)
          .map((g) => g.name);
        setFormData({ ...formData, name: generateChildGroupName(parent.name, siblings) });
      }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.foundedPeriod) return;

    const payload = {
      name: formData.name.trim(),
      meaning: formData.meaning.trim() || undefined,
      scripture: formData.scripture.trim() || undefined,
      meetingSchedule: formData.meetingSchedule.trim() || undefined,
      meetingLocation: formData.meetingLocation.trim() || undefined,
      color: formData.color,
      foundedPeriod: formData.foundedPeriod,
      parentGroupId: formData.parentGroupId || undefined,
    };

    if (editingGroup) {
      updateGroup(editingGroup.id, payload);
    } else {
      addGroup(payload as Omit<GroupWithRelations, 'id'>);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus kelompok ini? Semua data batch dan anggota akan ikut terhapus.')) {
      deleteGroup(id);
    }
  };

  const getChildren = (parentId: string) => groups.filter((g) => g.parentGroupId === parentId);

  if (!canAccess('struktur_manage')) {
    return (
      <div className="bg-white rounded-[28px] p-8 border border-red-200 text-center">
        <RotateCcw className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold">Akses Terbatas</h3>
        <p className="text-xs text-[#8C8880] mt-1">Kelola kelompok hanya untuk SUPERADMIN / KOMISI / COMMITTEE.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-1 flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Regenerasi Kelompok
            </p>
            <h2 className="text-xl font-bold">Kelola Kelompok & Generasi</h2>
            <p className="text-xs text-[#8C8880] mt-1">
              Kelompok induk ditampilkan di landing. Generasi (Agape 1, Agape 2, dst.) hanya di detail.
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Kelompok Induk
          </button>
        </div>

        <div className="space-y-4">
          {parentGroups.map((parent) => {
            const children = getChildren(parent.id);
            const hasChildren = children.length > 0;
            return (
              <div key={parent.id} className="border border-[#D9D7D0]/60 rounded-[24px] overflow-hidden">
                <div className="p-4 bg-white border-b border-[#D9D7D0]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shrink-0" style={{ backgroundColor: parent.color || '#181818' }}>
                      {parent.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-[#1B1B1B] truncate">{parent.name}</h4>
                      <p className="text-xs text-[#8C8880] flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">Induk</span>
                        {hasChildren && (
                          <span className="px-2 py-0.5 rounded-full bg-[#F6AE4A]/20 text-[#F6AE4A] text-[9px] font-black uppercase tracking-wider">
                            {children.length} Generasi
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openCreate(parent.id)}
                      className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold hover:border-black hover:bg-white transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Generasi Baru
                    </button>
                    <button onClick={() => openEdit(parent)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDeleteId(parent.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title="Hapus">
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {hasChildren && (
                  <div className="px-4 pb-4 bg-[#FAF9F5] space-y-2">
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#D9D7D0]/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: child.color || '#181818' }}>
                            {child.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{child.name}</p>
                            <p className="text-[10px] text-[#8C8880] flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded-full bg-[#F6AE4A]/20 text-[#F6AE4A] text-[8px] font-black uppercase tracking-wider">Gen-{getGenerationNumber(child.name) ?? '?'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openEdit(child)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(child.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title="Hapus">
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {parentGroups.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-[#D9D7D0] rounded-[24px]">
              <GitBranch className="w-12 h-12 text-[#8C8880]/40 mx-auto mb-3" />
              <p className="text-sm text-[#8C8880]">Belum ada kelompok induk. Tambahkan kelompok pertama untuk memulai.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Edit/Tambah */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-[#D9D7D0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-5">
              <h3 className="text-base font-bold">
                {editingGroup ? 'Edit Kelompok' : selectedParent ? 'Tambah Generasi Baru' : 'Tambah Kelompok Induk'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {!editingGroup && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Jenis Kelompok
                  </label>
                  <div className="flex rounded-full bg-[#F3F1EC] border border-[#D9D7D0] p-0.5 mb-3">
                    {[
                      { value: '', label: 'Induk', icon: Users },
                      { value: 'child', label: 'Generasi', icon: GitBranch },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, parentGroupId: opt.value === 'child' ? selectedParent : '' });
                        }}
                        className={`flex-1 h-8 rounded-full text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                          (opt.value === '' && !selectedParent) || (opt.value === 'child' && selectedParent)
                            ? 'bg-white shadow-sm'
                            : 'text-[#8C8880]'
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {editingGroup && editingGroup.parentGroupId && (
                <div className="p-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D]">
                  <p className="text-xs font-bold text-[#92400E] flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" /> Kelompok ini adalah generasi dari induk. Nama tidak bisa diubah manual.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Kelompok Induk <span className="normal-case text-[#8C8880]">(kosongkan untuk kelompok induk)</span>
                </label>
                <select
                  value={formData.parentGroupId}
                  onChange={(e) => handleParentChange(e.target.value)}
                  disabled={editingGroup?.parentGroupId}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                >
                  <option value="">— Tidak ada (Kelompok Induk) —</option>
                  {parentGroups.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Nama Kelompok *
                </label>
                <input
                  type="text"
                  required
                  placeholder={editingGroup?.parentGroupId ? 'Otomatis: [Nama Induk] N' : 'cth. Agape, Koinonia, Sio'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={editingGroup?.parentGroupId}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black disabled:bg-[#F3F1EC]"
                />
                {selectedParent && !editingGroup && (
                  <p className="text-[10px] text-[#8C8880] mt-1 flex items-center gap-1">
                    <GitBranch className="w-3 h-3" /> Nama otomatis: {formData.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Makna / Arti Nama
                </label>
                <input
                  type="text"
                  placeholder="cth. Cinta Kasih Allah"
                  value={formData.meaning}
                  onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Ayat Landasan
                </label>
                <textarea
                  rows={2}
                  placeholder="cth. 1 Korintus 13:4-7"
                  value={formData.scripture}
                  onChange={(e) => setFormData({ ...formData, scripture: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Jadwal Pertemuan
                  </label>
                  <input
                    type="text"
                    placeholder="Sabtu, 19:00 WIB"
                    value={formData.meetingSchedule}
                    onChange={(e) => setFormData({ ...formData, meetingSchedule: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Lokasi Pertemuan
                  </label>
                  <input
                    type="text"
                    placeholder="Rumah Mentor / Gereja / Zoom"
                    value={formData.meetingLocation}
                    onChange={(e) => setFormData({ ...formData, meetingLocation: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Warna Tema
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 rounded-xl border border-[#D9D7D0] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Periode Pendirian (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={formData.foundedPeriod}
                    onChange={(e) => setFormData({ ...formData, foundedPeriod: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#D9D7D0]/60 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold">
                  Batal
                </button>
                <button type="submit" className="px-5 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold">
                  Simpan & Sinkronkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); }}
        title="Hapus Kelompok"
        message="Apakah yakin ingin menghapus kelompok ini? Semua batch, anggota, dan data terkait akan terhapus permanen."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        requireTypeConfirmation
        typeConfirmationText="HAPUS"
      />
    </div>
  );
};