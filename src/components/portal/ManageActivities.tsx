import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ContentItem } from '../../types';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Search,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react';

export const ManageActivities: React.FC = () => {
  const { contentItems, addContentItem, updateContentItem, deleteContentItem } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    category: 'Konser & Ibadah',
    schedule: '',
    location: 'Main Sanctuary GEHC Cikarang',
    targetAudience: 'Seluruh Pemuda, Mahasiswa & Jemaat',
    scripture: '',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    tags: 'Praise & Worship, Youth, Fellowship',
    body: '',
    is_published: true,
  });

  const activityItems = contentItems.filter((c) => c.type === 'ACTIVITY');

  const filteredItems = activityItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      subtitle: '',
      category: 'Konser & Ibadah',
      schedule: 'Minggu, Pkl 13:00 WIB',
      location: 'Main Sanctuary GEHC Cikarang',
      targetAudience: 'Seluruh Pemuda & Jemaat Umum',
      scripture: '',
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
      tags: 'Praise, Youth Night, Fellowship',
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
      schedule: item.schedule || '',
      location: item.location || '',
      targetAudience: item.targetAudience || '',
      scripture: item.scripture || '',
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
        schedule: formData.schedule,
        location: formData.location,
        targetAudience: formData.targetAudience,
        scripture: formData.scripture,
        bannerUrl: formData.bannerUrl,
        tags: tagsArray,
        body: formData.body,
        is_published: formData.is_published,
      });
    } else {
      addContentItem({
        tenant_id: 'tenant-youth',
        type: 'ACTIVITY',
        title: formData.title,
        subtitle: formData.subtitle,
        category: formData.category,
        schedule: formData.schedule,
        location: formData.location,
        targetAudience: formData.targetAudience,
        scripture: formData.scripture,
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
            <Calendar className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Dynamic CMS
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Kelola Agenda & Kegiatan Pemuda
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Publikasikan konser, retret, turnamen olahraga, dan program pembinaan pemuda.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Buat Kegiatan Baru</span>
        </button>
      </div>

      {/* Table & List */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
        
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input
              type="text"
              placeholder="Cari kegiatan, waktu, atau tempat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <span className="text-xs font-semibold text-[#8C8880] hidden sm:inline">
            Total {filteredItems.length} Agenda
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Nama Acara</th>
                <th className="pb-3">Kategori</th>
                <th className="pb-3">Jadwal & Waktu</th>
                <th className="pb-3">Lokasi</th>
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
                        <p className="text-[11px] text-[#8C8880] truncate">{item.subtitle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 font-semibold text-[#1B1B1B]">{item.category}</td>
                  <td className="py-4 text-[#1B1B1B]">{item.schedule}</td>
                  <td className="py-4 text-[#8C8880]">{item.location}</td>
                  <td className="py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.is_published
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.is_published ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1B1B1B] transition-colors"
                        title="Edit Kegiatan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus kegiatan "${item.title}"?`)) {
                            deleteContentItem(item.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus Kegiatan"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0] relative flex flex-col">
            
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                {editingItem ? 'Edit Kegiatan Pemuda' : 'Buat Agenda Kegiatan Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Nama Kegiatan / Event *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Youth Creative Night 2026: Light in the Valley"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Tema / Tagline
                </label>
                <input
                  type="text"
                  placeholder="Tagline singkat kegiatan..."
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
                    <option value="Konser & Ibadah">Konser & Ibadah</option>
                    <option value="Pemuridan & Teologi">Pemuridan & Teologi</option>
                    <option value="Olahraga & Minat Bakat">Olahraga & Minat Bakat</option>
                    <option value="Diakonia & Sosial">Diakonia & Sosial</option>
                    <option value="Retret & Camp">Retret & Camp</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Target Peserta
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Seluruh Pemuda & Mahasiswa"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Waktu / Jadwal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sabtu, 5 September 2026 | Pkl 18:00 WIB"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Lokasi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Main Sanctuary GEHC / Gelanggang Futsal"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  URL Flyer / Banner
                </label>
                <input
                  type="text"
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Deskripsi Kegiatan, Rundown & Fasilitas *
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full p-4 rounded-2xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                  placeholder="Detail acara, pembicara, doorprize, fasilitas..."
                ></textarea>
              </div>

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
                  {editingItem ? 'Simpan Perubahan' : 'Simpan & Tayangkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
