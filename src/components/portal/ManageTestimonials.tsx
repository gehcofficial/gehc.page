import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote, Plus, Edit2, Trash2, X, Search } from 'lucide-react';

interface TestimonialItem {
  id: string;
  authorName: string;
  groupName?: string | null;
  quote: string;
  photoUrl?: string | null;
  userId?: string | null;
  isPublished: boolean;
  sortOrder: number;
}

const emptyForm = {
  authorName: '',
  groupName: '',
  quote: '',
  photoUrl: '',
  userId: '',
  isPublished: true,
  sortOrder: 0,
};

export const ManageTestimonials: React.FC = () => {
  const [items, setItems] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestimonialItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch('/api/testimonials', { credentials: 'include' });
      const d = await r.json();
      setItems(d.items || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  const filtered = items.filter(
    (i) =>
      i.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.groupName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.quote.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (item: TestimonialItem) => {
    setEditing(item);
    setForm({
      authorName: item.authorName,
      groupName: item.groupName || '',
      quote: item.quote,
      photoUrl: item.photoUrl || '',
      userId: item.userId || '',
      isPublished: item.isPublished,
      sortOrder: item.sortOrder,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim() || !form.quote.trim()) return;
    setSaving(true);
    try {
      const payload = {
        authorName: form.authorName.trim(),
        groupName: form.groupName.trim() || null,
        quote: form.quote.trim(),
        photoUrl: form.photoUrl.trim() || null,
        userId: form.userId.trim() || null,
        isPublished: form.isPublished,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await fetch(`/api/testimonials/${editing.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/testimonials', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      await fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TestimonialItem) => {
    if (!confirm(`Hapus testimoni dari ${item.authorName}?`)) return;
    await fetch(`/api/testimonials/${item.id}`, { method: 'DELETE', credentials: 'include' });
    fetchItems();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <MessageSquareQuote className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Landing Collage
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Kelola Testimoni
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Kutipan published tampil bergantian di collage halaman Beyonders.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs sm:text-sm font-bold shadow-md flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          + Testimoni Baru
        </button>
      </div>

      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
          <input
            type="text"
            placeholder="Cari nama, grup, atau kutipan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
          />
        </div>

        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-[#8C8880] p-4 rounded-2xl border border-dashed border-[#D9D7D0]">
            Belum ada testimoni. Tambahkan agar collage Beyonders menampilkan kutipan nyata.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-2">Nama</th>
                  <th className="pb-3">Grup</th>
                  <th className="pb-3">Kutipan</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 pr-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D7D0]/30">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF9F5]">
                    <td className="py-4 pl-2 font-bold text-[#1B1B1B]">{item.authorName}</td>
                    <td className="py-4 text-[#8C8880]">{item.groupName || '—'}</td>
                    <td className="py-4 text-[#1B1B1B] max-w-xs truncate">{item.quote}</td>
                    <td className="py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.isPublished ? 'Live' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0]">
            <div className="sticky top-0 bg-[#FAF9F5]/90 backdrop-blur-md px-6 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                {editing ? 'Edit Testimoni' : 'Testimoni Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5">Nama *</label>
                <input
                  required
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs"
                  placeholder="Nama depan + inisial jika perlu"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5">Grup</label>
                <input
                  value={form.groupName}
                  onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs"
                  placeholder="Logos, Avodah, …"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5">Kutipan *</label>
                <textarea
                  required
                  rows={4}
                  value={form.quote}
                  onChange={(e) => setForm({ ...form, quote: e.target.value })}
                  className="w-full p-4 rounded-2xl bg-white border border-[#D9D7D0] text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5">ID akun portal (opsional)</label>
                <input
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-mono"
                  placeholder="Taut ke user — foto mengikuti akun"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5">URL Foto (opsional)</label>
                <input
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-mono"
                  placeholder="https://…"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tst-pub"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="tst-pub" className="text-xs font-bold cursor-pointer">
                  Publikasikan ke landing
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-full bg-[#181818] text-white text-xs font-bold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan…' : editing ? 'Simpan' : 'Terbitkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTestimonials;
