import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ContentItem } from '../../types';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';

export const ManageWeeklyInfo: React.FC = () => {
  const { contentItems, addContentItem, updateContentItem, deleteContentItem, isSuperAdmin, isCommittee } =
    useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    category: 'Warta Mingguan',
    scripture: '',
    schedule: '',
    location: '',
    bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    tags: 'Warta, Ibadah Kreatif, Renungan',
    body: '',
    is_published: true,
  });

  const weeklyItems = contentItems.filter((c) => c.type === 'WEEKLY_INFO');

  const filteredItems = weeklyItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      subtitle: '',
      category: 'Warta Mingguan',
      scripture: '',
      schedule: 'Ibadah Pemuda: Setiap Minggu Pkl 13:00 WIB',
      location: 'Gereja GMIM Eben Haezer Cikarang',
      bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
      tags: 'Warta, Ibadah Kreatif, Pemuda',
      body: '',
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ContentItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      subtitle: item.subtitle || '',
      category: item.category,
      scripture: item.scripture || '',
      schedule: item.schedule || '',
      location: item.location || '',
      bannerUrl: item.bannerUrl,
      tags: item.tags.join(', '),
      body: item.body,
      is_published: item.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) return;

    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingItem) {
      updateContentItem(editingItem.id, {
        title: formData.title,
        subtitle: formData.subtitle,
        category: formData.category,
        scripture: formData.scripture,
        schedule: formData.schedule,
        location: formData.location,
        bannerUrl: formData.bannerUrl,
        tags: tagsArray,
        body: formData.body,
        is_published: formData.is_published,
      });
    } else {
      addContentItem({
        tenant_id: 'tenant-youth',
        type: 'WEEKLY_INFO',
        title: formData.title,
        subtitle: formData.subtitle,
        category: formData.category,
        scripture: formData.scripture,
        schedule: formData.schedule,
        location: formData.location,
        bannerUrl: formData.bannerUrl,
        tags: tagsArray,
        body: formData.body,
        is_published: formData.is_published,
        author: 'Komisi Pelayanan Pemuda',
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
            <BookOpen className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Dynamic CMS
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Kelola Warta Pemuda & Renungan
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Buat dan terbitkan warta mingguan. Konten langsung sinkron ke halaman publik `youth.gehc.page`.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tulis Warta Baru</span>
        </button>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
        
        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input
              type="text"
              placeholder="Cari judul warta, ayat, atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <span className="text-xs font-semibold text-[#8C8880] hidden sm:inline">
            Total {filteredItems.length} Warta
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Judul Warta</th>
                <th className="pb-3">Kategori</th>
                <th className="pb-3">Tanggal Rilis</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D7D0]/30">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF9F5] transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.bannerUrl}
                        alt={item.title}
                        className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-[#D9D7D0]"
                      />
                      <div className="min-w-0 max-w-md">
                        <h4 className="font-bold text-[#1B1B1B] truncate text-sm">{item.title}</h4>
                        {item.scripture && (
                          <p className="text-[11px] text-[#8C8880] truncate italic">"{item.scripture}"</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 font-semibold text-[#1B1B1B]">{item.category}</td>
                  <td className="py-4 text-[#8C8880]">{item.published_at}</td>
                  <td className="py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.is_published
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.is_published ? 'Published (Live)' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1B1B1B] transition-colors"
                        title="Edit Warta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus warta "${item.title}"?`)) {
                            deleteContentItem(item.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus Warta"
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
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0] relative flex flex-col">
            
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                {editingItem ? 'Edit Warta Pemuda' : 'Tulis Warta Pemuda Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Judul Warta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Warta Pemuda Minggu IV: Berakar dan Bertumbuh"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Sub-Judul / Ringkasan
                </label>
                <input
                  type="text"
                  placeholder="Ringkasan singkat topik renungan dan pengumuman..."
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  >
                    <option value="Warta Mingguan">Warta Mingguan</option>
                    <option value="Renungan & Khotbah">Renungan & Khotbah</option>
                    <option value="Diakonia & Pelayanan">Diakonia & Pelayanan</option>
                    <option value="Pengumuman Penting">Pengumuman Penting</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Nats / Ayat Alkitab
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kolose 2:6-7"
                    value={formData.scripture}
                    onChange={(e) => setFormData({ ...formData, scripture: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Jadwal Ibadah
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Minggu, 13:00 WIB"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Lokasi
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Main Sanctuary GEHC Cikarang"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  URL Banner Gambar (Google Drive / CDN)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Tags (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  placeholder="Warta, Ibadah Kreatif, Liturgi"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Isi Lengkap Warta & Renungan *
                </label>
                <textarea
                  required
                  rows={7}
                  placeholder="Tuliskan pesan warta, poin-poin khotbah, dan pengumuman ibadah..."
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full p-4 rounded-2xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="publish-check"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
                />
                <label htmlFor="publish-check" className="text-xs font-bold text-[#1B1B1B] cursor-pointer">
                  Langsung Publikasikan ke Halaman Web (Live)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-[#D9D7D0]/60 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold shadow-md"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Terbitkan Warta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
