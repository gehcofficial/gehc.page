import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Edit2, Trash2, LogOut, UserPlus, ArrowRight, RotateCcw, AlertTriangle, Calendar } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

interface MentorTransition {
  id: string;
  groupId: string;
  outgoingUserId: string;
  incomingUserId: string | null;
  outgoingRole: string;
  incomingRole: string | null;
  effectiveDate: string;
  reason: string | null;
  note: string | null;
  createdById: string;
  createdAt: string;
  outgoingUser: { id: string; name: string; email: string; avatar: string | null };
  incomingUser: { id: string; name: string; email: string; avatar: string | null } | null;
  createdBy: { id: string; name: string };
}

type FormState = {
  outgoingUserId: string;
  incomingUserId: string;
  outgoingRole: 'MENTOR' | 'CO_MENTOR';
  incomingRole: 'MENTOR' | 'CO_MENTOR';
  effectiveDate: string;
  reason: string;
  note: string;
};

const emptyForm = (): FormState => ({
  outgoingUserId: '',
  incomingUserId: '',
  outgoingRole: 'MENTOR',
  incomingRole: 'MENTOR',
  effectiveDate: new Date().toISOString().split('T')[0],
  reason: '',
  note: '',
});

const ROLE_LABELS: Record<string, string> = {
  MENTOR: 'Mentor',
  CO_MENTOR: 'Co-Mentor',
  MENTEE: 'Mentee',
  ALUMNI: 'Alumni',
  COMMITTEE: 'Committee',
  KOMISI: 'Komisi',
  BPMJ: 'BPMJ',
};

export const MentorTransitionManager: React.FC<{ groupId: string; groupName: string }> = ({ groupId, groupName }) => {
  const { strukturMembers, updateStrukturMember } = useApp();
  const [transitions, setTransitions] = useState<MentorTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransition, setEditingTransition] = useState<MentorTransition | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resignUserId, setResignUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'resign'>('list');

  const groupMentors = strukturMembers.filter(
    (m) => m.groupId === groupId && (m.role === 'MENTOR' || m.role === 'CO_MENTOR')
  );

  const groupMembers = strukturMembers.filter(
    (m) => m.groupId === groupId && m.role === 'MENTEE'
  );

  useEffect(() => {
    fetchTransitions();
  }, [groupId]);

  const fetchTransitions = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/groups/${groupId}/mentor-transitions`);
      const data = await resp.json();
      if (resp.ok) setTransitions(data.transitions || []);
    } catch (e) {
      console.error('Failed to fetch transitions:', e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (preset?: Partial<FormState>) => {
    setEditingTransition(null);
    setFormData({ ...emptyForm(), effectiveDate: new Date().toISOString().split('T')[0], ...preset });
    setIsModalOpen(true);
    setActiveTab('list');
  };

  const openEdit = (t: MentorTransition) => {
    setEditingTransition(t);
    setFormData({
      outgoingUserId: t.outgoingUserId,
      incomingUserId: t.incomingUserId || '',
      outgoingRole: t.outgoingRole as FormState['outgoingRole'],
      incomingRole: (t.incomingRole as FormState['incomingRole']) || 'MENTOR',
      effectiveDate: t.effectiveDate.split('T')[0],
      reason: t.reason || '',
      note: t.note || '',
    });
    setIsModalOpen(true);
    setActiveTab('list');
  };

  const openResign = (userId: string, role: string) => {
    setResignUserId(userId);
    setActiveTab('resign');
    setFormData({
      ...emptyForm(),
      outgoingUserId: userId,
      outgoingRole: role as FormState['outgoingRole'],
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: 'Pengunduran diri',
    });
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.outgoingUserId || !formData.effectiveDate) return;

    const endpoint = editingTransition
      ? `/api/mentor-transitions/${editingTransition.id}`
      : resignUserId
        ? `/api/groups/${groupId}/mentor-resign`
        : `/api/groups/${groupId}/mentor-transitions`;

    const method = editingTransition ? 'PATCH' : 'POST';
    const body = resignUserId
      ? { userId: formData.outgoingUserId, effectiveDate: formData.effectiveDate, reason: formData.reason }
      : {
          outgoingUserId: formData.outgoingUserId,
          incomingUserId: formData.incomingUserId || undefined,
          outgoingRole: formData.outgoingRole,
          incomingRole: formData.incomingUserId ? formData.incomingRole : undefined,
          effectiveDate: formData.effectiveDate,
          reason: formData.reason || undefined,
          note: formData.note || undefined,
        };

    try {
      const resp = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Gagal menyimpan transisi');
      await fetchTransitions();
      setIsModalOpen(false);
      setResignUserId(null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus riwayat transisi ini?')) return;
    try {
      const resp = await fetch(`/api/mentor-transitions/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Gagal menghapus');
      await fetchTransitions();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[28px] border border-[#D9D7D0]/60 p-8 text-center">
        <div className="w-8 h-8 border-2 border-[#FF416C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#8C8880] mt-2">Memuat riwayat transisi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-1">
              Transisi Mentor/Co-Mentor
            </p>
            <h3 className="text-lg font-bold">{groupName}</h3>
            <p className="text-xs text-[#8C8880] mt-0.5">
              Kelola pengunduran diri, pergantian batch, dan pencatatan transisi kepemimpinan kelompok
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openCreate()}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Catat Transisi
            </button>
            <button
              onClick={() => setActiveTab('resign')}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold hover:border-black transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Form Pengunduran Diri
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex rounded-full bg-[#F3F1EC] border border-[#D9D7D0] p-0.5">
            {(['list', 'resign'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 h-8 rounded-full text-[11px] font-bold transition-all ${
                  activeTab === tab ? 'bg-white shadow-sm' : 'text-[#8C8880]'
                }`}
              >
                {tab === 'list' ? 'Riwayat Transisi' : 'Pengunduran Diri'}
              </button>
            ))}
          </div>

          {activeTab === 'list' && (
            <div className="space-y-2 mt-3">
              {transitions.length === 0 && (
                <p className="text-xs text-[#8C8880] text-center py-6">Belum ada riwayat transisi mentor.</p>
              )}
              {transitions.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-[#D9D7D0]/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {t.outgoingRole === 'MENTOR' ? 'M' : 'CM'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{t.outgoingUser.name}</p>
                      <p className="text-[10px] text-[#8C8880] truncate">
                        {ROLE_LABELS[t.outgoingRole] || t.outgoingRole} →{' '}
                        {t.incomingUser ? (ROLE_LABELS[t.incomingRole || ''] || t.incomingRole || 'Mentor') + ' ' + t.incomingUser.name : '<strong>Pengunduran Diri</strong>'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#8C8880] font-mono whitespace-nowrap">
                      {new Date(t.effectiveDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'resign' && (
            <div className="space-y-4 mt-3 bg-white rounded-xl border border-[#D9D7D0]/50 p-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D]">
                <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#92400E]">Form Pengunduran Diri Mentor/Co-Mentor</p>
                  <p className="text-[10px] text-[#B45309]">
                    Mengundurkan diri akan mengubah peran menjadi MENTEE dan mencatat transisi di riwayat.
                  </p>
                </div>
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Mentor/Co-Mentor yang Mengundurkan Diri *
                  </label>
                  <select
                    value={formData.outgoingUserId}
                    onChange={(e) => setFormData({ ...formData, outgoingUserId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    required
                  >
                    <option value="">Pilih pengurus...</option>
                    {groupMentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({ROLE_LABELS[m.role || '']})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Tanggal Efektif *
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                    Alasan Pengunduran
                  </label>
                  <textarea
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Alasan pengunduran diri (opsional)"
                    className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-[#D9D7D0]/40">
                  <button type="button" onClick={() => { setIsModalOpen(false); setResignUserId(null); }} className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold">
                    Batal
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Proses Pengunduran Diri
                  </button>
                </div>
              </form>
            </div>
          )}

          {isModalOpen && activeTab === 'list' && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-[#D9D7D0]">
                <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-5">
                  <h3 className="text-base font-bold">
                    {editingTransition ? 'Edit Transisi' : 'Catat Transisi Mentor/Co-Mentor'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Mentor/Co-Mentor Keluar *
                    </label>
                    <select
                      value={formData.outgoingUserId}
                      onChange={(e) => setFormData({ ...formData, outgoingUserId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                      required
                    >
                      <option value="">Pilih pengurus...</option>
                      {groupMentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({ROLE_LABELS[m.role || '']})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Peran Keluar *
                    </label>
                    <select
                      value={formData.outgoingRole}
                      onChange={(e) => setFormData({ ...formData, outgoingRole: e.target.value as FormState['outgoingRole'] })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    >
                      <option value="MENTOR">MENTOR</option>
                      <option value="CO_MENTOR">CO_MENTOR</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Mentor/Co-Mentor Baru <span className="normal-case text-[#8C8880]">(kosongkan untuk pengunduran diri)</span>
                    </label>
                    <select
                      value={formData.incomingUserId}
                      onChange={(e) => setFormData({ ...formData, incomingUserId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                    >
                      <option value="">— Tidak ada pengganti (pengunduran diri) —</option>
                      {groupMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Mentee)
                        </option>
                      ))}
                      {groupMentors.filter(m => m.id !== formData.outgoingUserId).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({ROLE_LABELS[m.role || '']})
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.incomingUserId && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                        Peran Baru *
                      </label>
                      <select
                        value={formData.incomingRole}
                        onChange={(e) => setFormData({ ...formData, incomingRole: e.target.value as FormState['incomingRole'] })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                      >
                        <option value="MENTOR">MENTOR</option>
                        <option value="CO_MENTOR">CO_MENTOR</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Tanggal Efektif *
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveDate}
                      onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Alasan
                    </label>
                    <textarea
                      rows={3}
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="Alasan transisi / pengunduran diri..."
                      className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                      Catatan Tambahan
                    </label>
                    <textarea
                      rows={2}
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="Catatan internal (opsional)"
                      className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#D9D7D0]/60 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold">
                      Batal
                    </button>
                    <button type="submit" className="px-5 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold">
                      Simpan Transisi
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
            title="Hapus Riwayat Transisi"
            message="Apakah yakin ingin menghapus riwayat transisi ini? Tindakan ini tidak dapat dibatalkan."
            confirmText="Ya, Hapus"
            cancelText="Batal"
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
};