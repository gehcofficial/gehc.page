import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ContentItem } from '../../types';
import { SectionHeader } from './ui/SectionHeader';
import { useLang } from '../../context/LangContext';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Tag,
  Share2,
  Download,
  X,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';

export const WeeklyInfoSection: React.FC = () => {
  const { t } = useLang();
  const { contentItems, addToast } = useApp();
  const slots = useMediaSlots();
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Semua');
  const [album, setAlbum] = useState<{ name: string; url: string; mimeType?: string }[]>([]);

  const bannerOf = (item: ContentItem) => item.bannerUrl || slots.warta.bannerDefault;

  useEffect(() => {
    if (!selectedItem) {
      setAlbum([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedItem.published_at) params.set('publishedAt', selectedItem.published_at);
    if (selectedItem.title) params.set('title', selectedItem.title);
    fetch(`/api/media/warta-album?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled && Array.isArray(d.files)) setAlbum(d.files);
      })
      .catch(() => {
        if (!cancelled) setAlbum([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

  const weeklyPosts = contentItems.filter(
    (item) => item.type === 'WEEKLY_INFO' && item.is_published
  );

  const allTags = ['Semua', ...Array.from(new Set(weeklyPosts.flatMap((p) => p.tags)))];

  const filteredPosts = weeklyPosts.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.scripture && item.scripture.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = selectedTag === 'Semua' || item.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-b border-[#D9D7D0]/60 pb-8">
        <SectionHeader
          eyebrow={t.bulletin.eyebrow}
          title={t.bulletin.title}
          subtitle={t.bulletin.sub}
        />

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
          <input
            type="text"
            placeholder="Cari warta, tema, atau ayat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* Filter Tag Chips */}
      <div className="flex flex-wrap gap-2 mb-10">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
              selectedTag === tag
                ? 'bg-[#181818] text-white shadow-md'
                : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Warta Cards Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#D9D7D0]/40 p-8">
          <BookOpen className="w-12 h-12 text-[#8C8880] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-bold text-[#1B1B1B]">Belum Ada Warta Ditemukan</h3>
          <p className="text-xs text-[#8C8880] mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group bg-white rounded-[32px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1"
            >
              {/* Card Banner Image */}
              <div className="h-56 w-full relative overflow-hidden bg-[#F0EFEB]">
                <img
                  src={bannerOf(item)}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1B1B1B] text-[10px] font-bold">
                    {item.published_at}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-[#1B1B1B] group-hover:text-[#FF416C] transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h3>

                  {item.subtitle && (
                    <p className="text-xs text-[#8C8880] line-clamp-2 mb-4 font-medium">
                      {item.subtitle}
                    </p>
                  )}

                  {item.scripture && (
                    <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/50 text-xs text-[#1B1B1B] italic mb-4">
                      "{item.scripture}"
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#D9D7D0]/40 flex items-center justify-between">
                  <span className="text-[11px] text-[#8C8880] font-medium truncate max-w-[150px]">
                    Oleh: {item.author}
                  </span>
                  <span className="text-xs font-bold text-[#1B1B1B] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Baca Selengkapnya →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal / Reading Sheet */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0] relative flex flex-col">
            
            {/* Modal Header Bar */}
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                  {selectedItem.category}
                </span>
                <span className="text-xs text-[#8C8880]">Rilis: {selectedItem.published_at}</span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 sm:p-10 space-y-6">
              
              {/* Banner Image */}
              <div className="h-64 sm:h-80 w-full rounded-[28px] overflow-hidden relative shadow-md">
                <img
                  src={bannerOf(selectedItem)}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1B1B1B] font-display mb-2">
                  {selectedItem.title}
                </h2>
                {selectedItem.subtitle && (
                  <p className="text-base text-[#8C8880] leading-relaxed">
                    {selectedItem.subtitle}
                  </p>
                )}
              </div>

              {/* Scripture Highlight */}
              {selectedItem.scripture && (
                <div className="p-5 rounded-2xl bg-white border border-[#D9D7D0] shadow-sm flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#FF416C] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
                      Ayat & Nats Renungan Minggu Ini
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-[#1B1B1B] mt-0.5 italic">
                      "{selectedItem.scripture}"
                    </p>
                  </div>
                </div>
              )}

              {/* Worship Info Meta */}
              {(selectedItem.schedule || selectedItem.location) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F0EFEB] border border-[#D9D7D0]/50 text-xs">
                  {selectedItem.schedule && (
                    <div className="flex items-center gap-2 text-[#1B1B1B]">
                      <Clock className="w-4 h-4 text-[#FF416C] shrink-0" />
                      <span>{selectedItem.schedule}</span>
                    </div>
                  )}
                  {selectedItem.location && (
                    <div className="flex items-center gap-2 text-[#1B1B1B]">
                      <MapPin className="w-4 h-4 text-[#FF416C] shrink-0" />
                      <span>{selectedItem.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Body Text */}
              <div className="text-sm sm:text-base text-[#1B1B1B] leading-relaxed whitespace-pre-line space-y-4 pt-2 font-normal">
                {selectedItem.body}
              </div>

              {album.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] mb-3">
                    Foto & video edisi
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {album.map((file) => (
                      <a
                        key={file.url + file.name}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="aspect-square rounded-2xl overflow-hidden bg-[#F0EFEB] border border-[#D9D7D0]/40"
                      >
                        {file.mimeType?.startsWith('video/') ? (
                          <video src={file.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-6 border-t border-[#D9D7D0]/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white border border-[#D9D7D0] text-[11px] font-medium text-[#8C8880]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      addToast({
                        type: 'success',
                        title: 'Tautan Warta Disalin',
                        description: 'Bagikan ke grup WhatsApp pemuda.',
                      });
                    }}
                    className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Bagikan</span>
                  </button>

                  <button
                    onClick={() => {
                      addToast({
                        type: 'info',
                        title: 'Mengunduh Warta PDF',
                        description: 'Lembar buletin digital siap dibaca offline.',
                      });
                    }}
                    className="px-4 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
