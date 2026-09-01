import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StrukturMember } from '../../types';
import { PANTATUGAS } from '../../lib/pantatugas';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  Network,
  LayoutGrid,
  List,
  UserPlus,
  Sparkles,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

const byDivision = (list: StrukturMember[], division: string) =>
  list.filter((m) => (m.division || '').toUpperCase() === division);

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

type FormState = {
  name: string;
  position: string;
  division: string;
  subdivision: string;
  photoUrl: string;
  phone: string;
  email: string;
  bio: string;
  order: number;
  isOpenRole: boolean;
  // Role hierarchy fields
  role: 'MENTOR' | 'CO_MENTOR' | 'MENTEE' | 'ALUMNI' | 'COMMITTEE' | 'KOMISI' | 'BPMJ';
  roleOrder: number;
  isDoubleRole: boolean;
  subRoleId: string;
  groupId: string;
};

const emptyForm = (): FormState => ({
  name: '',
  position: '',
  division: 'LITURGIA',
  subdivision: '',
  photoUrl: '',
  phone: '',
  email: '',
  bio: '',
  order: 99,
  isOpenRole: false,
  role: 'MENTEE',
  roleOrder: 0,
  isDoubleRole: false,
  subRoleId: '',
  groupId: '',
});

/**
 * Organizational Chart Editor — kelola struktur via pohon interaktif.
 * Setiap kartu orang bisa diedit/dihapus; posisi tanpa nama ditandai
 * "posisi terbuka". Semua mutasi auto-sync ke TiDB & landing.
 */
export const ManageStruktur: React.FC = () => {
  const {
    strukturMembers,
    addStrukturMember,
    updateStrukturMember,
    deleteStrukturMember,
    canAccess,
  } = useApp();

  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StrukturMember | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteData, setConfirmDeleteData] = useState<{ id: string; name: string; hasDependencies: boolean } | null>(null);

  const sorted = useMemo(
    () => [...strukturMembers].sort((a, b) => a.order - b.order),
    [strukturMembers]
  );

  const bpmjMembers = byDivision(sorted, 'BPMJ');
  const komisiMembers = byDivision(sorted, 'KOMISI');
  const timKerjaMembers = byDivision(sorted, 'TIMKERJA');
  const pillars = PANTATUGAS.map((p) => ({
    meta: p,
    members: sorted.filter((m) => (m.division || '').toUpperCase() === p.name),
  }));
  const benzarMembers = byDivision(sorted, 'BENZARPR');
  // Grouping BZP per sub-divisi; anggota tanpa subdivisi = Kepala (ditampilkan duluan)
  const benzarGroups = (() => {
    const map = new Map<string, StrukturMember[]>();
    for (const m of benzarMembers) {
      const k = m.subdivision?.trim() || 'Kepala';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()].sort(([a]) => (a === 'Kepala' ? -1 : 1));
  })();

  // ---------- Modal ----------
  const openCreate = (preset?: Partial<FormState>) => {
    setEditingMember(null);
    setFormData({ ...emptyForm(), order: strukturMembers.length + 1, ...preset });
    setIsModalOpen(true);
  };

  const openEdit = (m: StrukturMember) => {
    setEditingMember(m);
    setFormData({
      name: m.name,
      position: m.position || '',
      division: m.division || 'LITURGIA',
      subdivision: m.subdivision || '',
      photoUrl: m.photoUrl || '',
      phone: m.phone || '',
      email: m.email || '',
      bio: m.bio || '',
      order: m.order,
      isOpenRole: Boolean(m.isOpenRole),
      role: m.role || 'MENTEE',
      roleOrder: m.roleOrder || 0,
      isDoubleRole: Boolean(m.isDoubleRole),
      subRoleId: m.subRoleId || '',
      groupId: m.groupId || '',
    });
    setIsModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.position.trim()) return;

    const payload = {
      name: formData.name.trim(),
      position: formData.position.trim(),
      division: formData.division,
      subdivision: formData.subdivision.trim() || undefined,
      photoUrl: formData.photoUrl,
      phone: formData.phone,
      email: formData.email,
      bio: formData.bio,
      order: Number(formData.order),
      isOpenRole: formData.isOpenRole,
      role: formData.isOpenRole ? undefined : formData.role,
      roleOrder: formData.isOpenRole ? 0 : formData.roleOrder,
      isDoubleRole: formData.isOpenRole ? false : formData.isDoubleRole,
      subRoleId: formData.isOpenRole ? undefined : (formData.subRoleId.trim() || undefined),
      groupId: formData.isOpenRole ? undefined : (formData.groupId.trim() || undefined),
    };

    if (editingMember) updateStrukturMember(editingMember.id, payload);
    else addStrukturMember(payload as Omit<StrukturMember, 'id'>);

    setIsModalOpen(false);
  };

  // ---------- Kartu orang kecil (chart) ----------
  const PersonChip: React.FC<{ m: StrukturMember }> = ({ m }) => (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#D9D7D0]/50">
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src={m.photoUrl || initialsAvatar(m.name)}
          alt={m.name}
          loading="lazy"
          decoding="async"
          className={`w-8 h-8 rounded-full object-cover border shrink-0 ${
            m.isOpenRole ? 'border-dashed border-[#8C8880]/60' : 'border-[#D9D7D0]'
          }`}
        />
        <div className="min-w-0">
          <p className="text-xs font-bold truncate">{m.isOpenRole ? `${m.subdivision || m.name} — terbuka` : m.name}</p>
          <p className="text-[10px] text-[#8C8880] truncate">{m.position}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 rounded-lg hover:bg-gray-100">
          <Edit2 className="w-3.5 h-3.5 text-[#1B1B1B]" />
        </button>
        <button
          onClick={() => {
            const hasDeps = false; // Could check: m.isOpenRole, or if mentor in group, etc.
            setConfirmDeleteData({ id: m.id, name: m.name, hasDependencies: hasDeps });
          }}
          title="Hapus"
          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const AddBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#D9D7D0] text-[10px] font-bold uppercase tracking-wider text-[#8C8880] hover:border-black hover:text-[#1B1B1B] transition-colors"
    >
      <UserPlus className="w-3 h-3" /> {label}
    </button>
  );

  // ---------- Gate ----------
  if (!canAccess('struktur_manage')) {
    return (
      <div className="bg-white rounded-[32px] p-8 sm:p-16 border border-red-200 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <ShieldCheck className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold">Akses Terbatas</h3>
        <p className="text-xs text-[#8C8880] mt-1">
          Kelola struktur hanya untuk SUPERADMIN / KOMISI / COMMITTEE.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <Network className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Organizational Chart Editor
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Struktur Komisi Pemuda</h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1 max-w-2xl leading-relaxed">
            Klik kartu untuk mengedit nama & jabatan. Setiap perubahan otomatis tersimpan ke TiDB
            dan tampil di landing page.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="flex rounded-full bg-[#F3F1EC] border border-[#D9D7D0] p-0.5">
            {(['chart', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 h-8 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  view === v ? 'bg-white shadow-sm' : 'text-[#8C8880]'
                }`}
              >
                {v === 'chart' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                {v === 'chart' ? 'Chart' : 'Tabel'}
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreate()}
            className="px-4 py-2.5 h-9 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Pengurus
          </button>
        </div>
      </div>

      {/* ================= CHART VIEW ================= */}
      {view === 'chart' && (
        <div className="space-y-6">
          {/* Level 1: BPMJ */}
          <div className="rounded-[32px] bg-gradient-to-r from-[#181818] to-[#262626] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-300" /> BPMJ — Badan Pekerja Majelis Jemaat
              </p>
              <AddBtn label="+ BPMJ" onClick={() => openCreate({ division: 'BPMJ', position: '' })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {bpmjMembers.map((m) => (
                <PersonChip key={m.id} m={m} />
              ))}
              {bpmjMembers.length === 0 && (
                <p className="text-[11px] text-white/40 col-span-full italic">Belum ada pengurus BPMJ.</p>
              )}
            </div>
          </div>

          {/* Level 2: Komisi Pemuda */}
          <div className="rounded-[32px] border-2 border-[#FF416C]/25 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#FF416C]">
                Komisi Pemuda — dipimpin Penatua Pemuda · periode 5 tahun
              </p>
              <AddBtn label="+ Komisi" onClick={() => openCreate({ division: 'KOMISI', position: '' })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {komisiMembers.map((m) => (
                <PersonChip key={m.id} m={m} />
              ))}
              {komisiMembers.length === 0 && (
                <p className="text-[11px] text-[#8C8880] col-span-full italic">Belum ada pengurus komisi.</p>
              )}
            </div>
          </div>

          {/* Level 2b: BOD Tim Kerja */}
          <div className="rounded-[32px] border border-[#D9D7D0]/60 bg-[#FAFAF5] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#181818]">
                Tim Kerja — pelaksana program (rotasi tahunan)
              </p>
              <AddBtn label="+ Tim Kerja" onClick={() => openCreate({ division: 'TIMKERJA', position: '' })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {timKerjaMembers.map((m) => (
                <PersonChip key={m.id} m={m} />
              ))}
              {timKerjaMembers.length === 0 && (
                <p className="text-[11px] text-[#8C8880] col-span-full italic">Belum ada pengurus tim kerja.</p>
              )}
            </div>
          </div>

          {/* Level 3: Lima Panca Tugas (tanpa BENZARPR yang sudah punya section sendiri) */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pillars
              .filter(({ meta }) => meta.name !== 'BENZARPR')
              .map(({ meta: p, members }) => {
              const subs = new Map<string, StrukturMember[]>();
              for (const m of members) {
                const k = m.subdivision?.trim() || 'Anggota';
                if (!subs.has(k)) subs.set(k, []);
                subs.get(k)!.push(m);
              }
              return (
                <div
                  key={p.name}
                  className="rounded-[28px] bg-white border-t-4 overflow-hidden"
                  style={{ borderColor: p.color }}
                >
                  <div className="p-4 pb-2 flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase" style={{ color: p.color }}>
                      {p.label}
                    </h4>
                    <AddBtn
                      label="+ Orang"
                      onClick={() =>
                        openCreate({
                          division: p.name,
                          isOpenRole: false,
                          position: '',
                        })
                      }
                    />
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    {[...subs.entries()].map(([sub, list]) => (
                      <div key={sub}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8880] mb-1">
                          {sub}
                        </p>
                        <div className="space-y-1.5">
                          {list.map((m) => (
                            <PersonChip key={m.id} m={m} />
                          ))}
                        </div>
                        <div className="mt-1.5">
                          <AddBtn
                            label={`+ ${sub}`}
                            onClick={() =>
                              openCreate({
                                division: p.name,
                                subdivision: sub === 'Anggota' ? '' : sub,
                                isOpenRole: false,
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    {subs.size === 0 && (
                      <p className="text-[11px] text-[#8C8880] italic">
                        Belum ada anggota — tambahkan orang pertama.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Level 4: Benzarpreneurship (BZP) */}
          <div className="rounded-[32px] border border-[#F6AE4A]/40 bg-[#FAFAF0] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#F6AE4A]">
                Benzarpreneurship (BZP) — Merchandise · Fundraising · Donation
              </p>
              <AddBtn label="+ BZP" onClick={() => openCreate({ division: 'BENZARPR', position: '' })} />
            </div>
            <div className="space-y-3">
              {benzarGroups.map(([sub, list]) => (
                <div key={sub}>
                  {sub !== 'Kepala' && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#8C8880] mb-1">{sub}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {list.map((m) => (
                      <PersonChip key={m.id} m={m} />
                    ))}
                  </div>
                </div>
              ))}
              {benzarMembers.length === 0 && (
                <p className="text-[11px] text-[#8C8880] italic">Belum ada pengurus BZP.</p>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-[#8C8880] flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Centang “Posisi terbuka” pada form bila slot belum memiliki nama.
          </p>
        </div>
      )}

      {/* ================= TABLE VIEW ================= */}
      {view === 'table' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-[28px] p-5 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-start gap-4 mb-4">
                <img
                  src={m.photoUrl || initialsAvatar(m.name)}
                  alt={m.name}
                  loading="lazy"
                  decoding="async"
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-[#D9D7D0]"
                />
                <div className="min-w-0">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold uppercase">
                    {m.division || 'CORE'}
                    {m.isOpenRole ? ' • TERBUKA' : ''}
                  </span>
                  <h4 className="text-base font-bold mt-1 leading-snug truncate">{m.name}</h4>
                  <p className="text-xs font-semibold text-[#FF416C]">{m.position}</p>
                </div>
              </div>
              {m.bio && (
                <p className="text-xs text-[#8C8880] line-clamp-2 mb-4 leading-relaxed">{m.bio}</p>
              )}
              {!m.isOpenRole && m.role && (
                <div className="mb-3 p-2 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0]/50">
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-white border border-[#D9D7D0] font-bold text-[#181818]">
                      {m.role}
                    </span>
                    {m.roleOrder !== undefined && m.roleOrder !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-[#E5E7EB] text-[#6B7280] font-mono">
                        H#{m.roleOrder}
                      </span>
                    )}
                    {m.isDoubleRole && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-bold">
                        Dobel
                      </span>
                    )}
                    {m.subRoleId && (
                      <span className="px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-mono text-[9px]">
                        {m.subRoleId}
                      </span>
                    )}
                    {m.groupId && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FCE7F3] text-[#BE185D] font-mono text-[9px]">
                        {m.groupId}
                      </span>
                    )}
                    {m.role === 'ALUMNI' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#9CA3AF] font-bold">
                        ALUMNI
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-[#D9D7D0]/40 flex items-center justify-between">
                <span className="text-[10px] text-[#8C8880] font-mono">#{m.order}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const hasDeps = false;
                      setConfirmDeleteData({ id: m.id, name: m.name, hasDependencies: hasDeps });
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Konfirmasi hapus - using reusable ConfirmationModal */}
      <ConfirmationModal
        isOpen={!!confirmDeleteData}
        onClose={() => setConfirmDeleteData(null)}
        onConfirm={() => {
          if (confirmDeleteData) {
            deleteStrukturMember(confirmDeleteData.id);
            setConfirmDeleteData(null);
          }
        }}
        title="Hapus Entri Struktur"
        message={`Apakah yakin ingin menghapus <strong>${confirmDeleteData?.name || 'entri ini'}</strong>? Data akan hilang dari panel dan landing page (tersinkron ke TiDB).`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
        requireTypeConfirmation={confirmDeleteData?.hasDependencies ?? false}
        typeConfirmationText="HAPUS"
      />

      {/* Modal Edit/Tambah */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-[#D9D7D0] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-5">
              <h3 className="text-base font-bold">
                {editingMember ? 'Edit Pengurus' : 'Tambah Pengurus'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Toggle posisi terbuka */}
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#D9D7D0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isOpenRole}
                  onChange={(e) => setFormData({ ...formData, isOpenRole: e.target.checked })}
                  className="w-4 h-4 accent-[#FF416C]"
                />
                <span className="text-xs font-bold">
                  Posisi terbuka{' '}
                  <span className="font-normal text-[#8C8880]">
                    (slot kosong — tampil bergaris putus di landing, tanpa nama)
                  </span>
                </span>
              </label>

              {!formData.isOpenRole && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required={!formData.isOpenRole}
                    placeholder="Nama pengurus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Jabatan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ketua Komisi / PIC Logistik"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Fungsi (Pantatugas)
                  </label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  >
                    <option value="LITURGIA">LITURGIA — Liturgi, Musik & Doa</option>
                    <option value="DIDASKALIA">DIDASKALIA — Kurikulum & Pembekalan Tim</option>
                    <option value="KOINONIA">KOINONIA — Acara, Persekutuan & Komunikasi</option>
                    <option value="DIAKONIA">DIAKONIA — Logistik, Mercy & Perantau</option>
                    <option value="MARTURIA">MARTURIA — Dokumentasi, Desain & Kesaksian</option>
                    <option value="BENZARPR">Benzarpreneurship — Merch, Fundraising, Donasi</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Sub-Divisi <span className="normal-case text-[#8C8880]">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="cth. Doa & Intercession / Kasih Peduli & Benevolence"
                    value={formData.subdivision}
                    onChange={(e) => setFormData({ ...formData, subdivision: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Role Hierarchy Fields */}
              {!formData.isOpenRole && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#D9D7D0]/40">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Peran Organisasi <span className="normal-case text-[#8C8880]">(hirarki)</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as FormState['role'] })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    >
                      <option value="BPMJ">BPMJ — Badan Pekerja Majelis Jemaat</option>
                      <option value="KOMISI">KOMISI — Komisi Pemuda</option>
                      <option value="COMMITTEE">COMMITTEE — Tim Kerja Pusat</option>
                      <option value="MENTOR">MENTOR — Pembimbing Kelompok</option>
                      <option value="CO_MENTOR">CO_MENTOR — Co-Pembimbing</option>
                      <option value="MENTEE">MENTEE — Anggota / Mentee</option>
                      <option value="ALUMNI">ALUMNI — Alumni / Bekas Pengurus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Urutan Hirarki <span className="normal-case text-[#8C8880]">(semakin kecil = semakin atas)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.roleOrder}
                      onChange={(e) => setFormData({ ...formData, roleOrder: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Dobel Peran <span className="normal-case text-[#8C8880]">(mis. Mentor + PIC Sub-Divisi)</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#D9D7D0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isDoubleRole}
                        onChange={(e) => setFormData({ ...formData, isDoubleRole: e.target.checked })}
                        className="w-4 h-4 accent-[#FF416C]"
                      />
                      <span className="text-xs font-bold">Ya, memegang dobel peran</span>
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Sub-Role ID <span className="normal-case text-[#8C8880]">(ID sub-jabatan spesifik, opsional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="cth. sub-role-konsumsi, sub-role-pendoa"
                      value={formData.subRoleId}
                      onChange={(e) => setFormData({ ...formData, subRoleId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-mono text-[11px] focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Grup Mentoring ID <span className="normal-case text-[#8C8880]">(hanya untuk MENTOR/CO_MENTOR, opsional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="cth. grp-agape-2026"
                      value={formData.groupId}
                      onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-mono text-[11px] focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  URL Foto Profil
                </label>
                <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-mono text-[11px] focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Telepon / WA (tidak tampil publik)
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
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
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Bio Singkat
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
                  Simpan & Sinkronkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
