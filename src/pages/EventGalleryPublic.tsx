import React, { useEffect, useState, useCallback } from 'react';
import { Image, Loader2, ChevronLeft, ChevronRight, Download, Eye, Share2, Heart, MessageSquare, ExternalLink } from 'lucide-react';

interface GalleryItem {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  mediaUrl: string;
  mediaType: 'PHOTO' | 'VIDEO';
  thumbUrl?: string | null;
  uploadedById: string;
  division?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectReason?: string | null;
  driveFileId?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const MEDIA_TYPE_LABELS = { PHOTO: 'Foto', VIDEO: 'Video' };
const MEDIA_TYPE_ICONS = { PHOTO: <Image className="w-4 h-4" />, VIDEO: <Share2 className="w-4 h-4" /> };

export default function EventGalleryPublic() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [currentEventId, setCurrentEventId] = useState<string>('evt-baku-tau-4-0');
  const [eventTitle, setEventTitle] = useState<string>('BAKU TAU 4.0');

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch(`/api/gallery/public?eventId=${currentEventId}&approvedOnly=1`);
      const d = await r.json();
      const sorted = (d.items || []).sort((a: GalleryItem, b: GalleryItem) => a.sortOrder - b.sortOrder);
      setItems(sorted);
    } catch { /* skip */ }
  }, [currentEventId]);

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  useEffect(() => {
    // Fetch event title
    fetch(`/api/events/${currentEventId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.event?.name && setEventTitle(d.event.name))
      .catch(() => {});
  }, [currentEventId]);

  const openModal = (index: number) => {
    setSelectedIndex(index);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setShowModal(false);
    document.body.style.overflow = '';
  };

  const nextItem = () => setSelectedIndex((i) => (i + 1) % items.length);
  const prevItem = () => setSelectedIndex((i) => (i - 1 + items.length) % items.length);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!showModal) return;
      if (e.key === 'ArrowRight') nextItem();
      if (e.key === 'ArrowLeft') prevItem();
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal, items.length]);

  const handleShare = async (item: GalleryItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.description || `Galeri ${eventTitle}`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link disalin ke clipboard!');
    }
  };

  const handleDownload = (item: GalleryItem) => {
    const a = document.createElement('a');
    a.href = item.mediaUrl;
    a.download = `${item.title}.${item.mediaType === 'VIDEO' ? 'mp4' : 'jpg'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleOpenDrive = (item: GalleryItem) => {
    if (item.driveFileId) {
      window.open(`https://drive.google.com/file/d/${item.driveFileId}/view`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#F6AE4A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#D9D7D0]/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F6AE4A] to-[#E89B3A] flex items-center justify-center text-white font-bold text-xs">
                GEHC
              </div>
              <div>
                <h1 className="text-lg font-black text-[#1B1B1B]">Event Gallery</h1>
                <p className="text-xs text-[#8C8880]">{eventTitle}</p>
              </div>
            </div>
            <a href="/#/benzarpreneurship" className="px-4 py-2 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-xs font-bold hover:bg-[#E89B3A] transition-colors">
              <ExternalLink className="w-3.5 h-3.5 inline mr-1" /> Benzarpreneurship
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Image className="w-20 h-20 text-[#D9D7D0] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1B1B1B] mb-2">Belum Ada Galeri</h2>
            <p className="text-[#8C8880]">Foto/video event akan tampil di sini setelah disetujui Tim Kerja.</p>
          </div>
        ) : (
          <>
            {/* Masonry Grid */}
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 mb-8">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => openModal(index)}
                  className="break-inside-avoid mb-4 cursor-pointer group relative"
                >
                  <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                    <div className="aspect-[4/5] relative bg-gray-100 overflow-hidden">
                      {item.thumbUrl ? (
                        <img
                          src={item.thumbUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : item.mediaUrl ? (
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#D9D7D0]">
                          <Image className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-sm text-[#F6AE4A]">
                          {MEDIA_TYPE_LABELS[item.mediaType]}
                        </span>
                      </div>
                      {item.mediaType === 'VIDEO' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors">
                          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-6 h-6 text-[#1B1B1B] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm text-[#1B1B1B] truncate group-hover:text-[#F6AE4A] transition-colors">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-[#8C8880] mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-[#8C8880]">
                        {item.division && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FAF9F5] border border-[#D9D7D0]">
                            {item.division}
                          </span>
                        )}
                        <span>{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more / pagination placeholder */}
            {items.length > 20 && (
              <div className="text-center">
                <button className="px-6 py-2 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50">
                  Muat Lebih
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#D9D7D0]/50 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-[#8C8880]">
          <p>GEHC Youth Portal — Galeri Event</p>
          <p className="mt-1">Foto & video hanya ditampilkan setelah disetujui Tim Kerja</p>
        </div>
      </footer>

      {/* Fullscreen Modal */}
      {showModal && items[selectedIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Galeri Fullscreen"
        >
          <button
            onClick={(e) => { e.stopPropagation(); prevItem(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl transition-colors"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); nextItem(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl transition-colors"
            aria-label="Selanjutnya"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); closeModal(); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Tutup"
          >
            <ExternalLink className="w-6 h-6" />
          </button>

          <div className="max-w-5xl max-h-[90vh] w-full mx-4 relative">
            {items[selectedIndex].mediaType === 'VIDEO' ? (
              <video
                src={items[selectedIndex].mediaUrl}
                controls
                className="w-full rounded-xl"
                autoPlay
              />
            ) : (
              <img
                src={items[selectedIndex].mediaUrl}
                alt={items[selectedIndex].title}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent rounded-b-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{items[selectedIndex].title}</h3>
                  {items[selectedIndex].description && (
                    <p className="text-sm opacity-80 mt-1">{items[selectedIndex].description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs opacity-60">
                    <span className="flex items-center gap-1">
                      {MEDIA_TYPE_ICONS[items[selectedIndex].mediaType]}
                      {MEDIA_TYPE_LABELS[items[selectedIndex].mediaType]}
                    </span>
                    {items[selectedIndex].division && (
                      <span className="px-2 py-0.5 rounded bg-white/20">{items[selectedIndex].division}</span>
                    )}
                    <span>{selectedIndex + 1} / {items.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(items[selectedIndex]); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Bagikan"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(items[selectedIndex]); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {items[selectedIndex].driveFileId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDrive(items[selectedIndex]); }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      aria-label="Buka di Google Drive"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); nextItem(); }}
            className="absolute right-4 bottom-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl transition-colors hidden sm:block"
            aria-label="Selanjutnya"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}