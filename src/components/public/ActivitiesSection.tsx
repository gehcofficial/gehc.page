import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ContentItem } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Share2,
  X,
  Search,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const ActivitiesSection: React.FC = () => {
  const { contentItems, addToast } = useApp();
  const [selectedActivity, setSelectedActivity] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [rsvpList, setRsvpList] = useState<{ [activityId: string]: boolean }>({});

  const activities = contentItems.filter(
    (item) => item.type === 'ACTIVITY' && item.is_published
  );

  const categories = ['Semua', ...Array.from(new Set(activities.map((a) => a.category)))];

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.location && act.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = selectedCategory === 'Semua' || act.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  const handleToggleRsvp = (activityId: string, title: string) => {
    const isJoined = !rsvpList[activityId];
    setRsvpList((prev) => ({ ...prev, [activityId]: isJoined }));
    if (isJoined) {
      addToast({
        type: 'success',
        title: 'Konfirmasi Kehadiran Berhasil (RSVP)',
        description: `Anda terdaftar pada kegiatan "${title}". Pengingat jadwal telah dikirimkan.`,
      });
    } else {
      addToast({
        type: 'info',
        title: 'Pendaftaran Dibatalkan',
        description: `Anda membatalkan konfirmasi pada "${title}".`,
      });
    }
  };

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-[1440px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-b border-[#D9D7D0]/60 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D9D7D0] mb-3">
            <Calendar className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Agenda & Kegiatan Pemuda
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1B1B1B] font-display">
            Kegiatan & Perjumpaan
          </h2>
          <p className="text-sm sm:text-base text-[#8C8880] mt-2 max-w-xl">
            Ikuti berbagai program pembinaan iman, konser pujian, turnamen olahraga, dan aksi diakonia bersama pemuda GEHC.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
          <input
            type="text"
            placeholder="Cari kegiatan, lokasi, atau tema..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
              selectedCategory === cat
                ? 'bg-[#181818] text-white shadow-md'
                : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Activity Grid */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#D9D7D0]/40 p-8">
          <Calendar className="w-12 h-12 text-[#8C8880] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-bold text-[#1B1B1B]">Tidak Ada Kegiatan Ditemukan</h3>
          <p className="text-xs text-[#8C8880] mt-1">Coba pilih kategori lain atau reset pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredActivities.map((act) => {
            const isRsvpd = rsvpList[act.id];

            return (
              <div
                key={act.id}
                className="group bg-white rounded-[32px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Flyer Container */}
                  <div
                    onClick={() => setSelectedActivity(act)}
                    className="h-60 w-full relative overflow-hidden bg-[#F0EFEB] cursor-pointer"
                  >
                    <img
                      src={act.bannerUrl}
                      alt={act.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        {act.category}
                      </span>
                    </div>
                    {isRsvpd && (
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          Terdaftar
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-6">
                    <h3
                      onClick={() => setSelectedActivity(act)}
                      className="text-xl font-bold tracking-tight text-[#1B1B1B] group-hover:text-[#FF416C] transition-colors line-clamp-2 mb-2 cursor-pointer"
                    >
                      {act.title}
                    </h3>

                    {act.subtitle && (
                      <p className="text-xs text-[#8C8880] line-clamp-2 mb-4 font-medium">
                        {act.subtitle}
                      </p>
                    )}

                    <div className="space-y-2 py-3 border-y border-[#D9D7D0]/40 text-xs text-[#1B1B1B]">
                      {act.schedule && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#FF416C] shrink-0" />
                          <span className="font-semibold">{act.schedule}</span>
                        </div>
                      )}
                      {act.location && (
                        <div className="flex items-center gap-2 text-[#8C8880]">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{act.location}</span>
                        </div>
                      )}
                      {act.targetAudience && (
                        <div className="flex items-center gap-2 text-[#8C8880]">
                          <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{act.targetAudience}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedActivity(act)}
                    className="text-xs font-bold text-[#1B1B1B] hover:text-[#FF416C] transition-colors"
                  >
                    Detail Acara
                  </button>

                  <button
                    onClick={() => handleToggleRsvp(act.id, act.title)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                      isRsvpd
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-[#181818] hover:bg-black text-white'
                    }`}
                  >
                    {isRsvpd ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Saya Hadir</span>
                      </>
                    ) : (
                      <>
                        <span>Daftar / RSVP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0] relative flex flex-col">
            
            {/* Modal Top Bar */}
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                  {selectedActivity.category}
                </span>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-10 space-y-6">
              <div className="h-64 sm:h-80 w-full rounded-[28px] overflow-hidden relative shadow-md">
                <img
                  src={selectedActivity.bannerUrl}
                  alt={selectedActivity.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1B1B1B] font-display mb-2">
                  {selectedActivity.title}
                </h2>
                {selectedActivity.subtitle && (
                  <p className="text-base text-[#8C8880] leading-relaxed">
                    {selectedActivity.subtitle}
                  </p>
                )}
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white border border-[#D9D7D0] shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-[#FF416C] mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#8C8880]">Waktu & Jadwal</span>
                      <p className="text-xs font-semibold text-[#1B1B1B]">{selectedActivity.schedule}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#8C8880]">Lokasi</span>
                      <p className="text-xs font-semibold text-[#1B1B1B]">{selectedActivity.location}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#8C8880]">Target Peserta</span>
                      <p className="text-xs font-semibold text-[#1B1B1B]">{selectedActivity.targetAudience}</p>
                    </div>
                  </div>

                  {selectedActivity.scripture && (
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8C8880]">Landasan Firman</span>
                        <p className="text-xs font-semibold text-[#1B1B1B] italic">{selectedActivity.scripture}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="text-sm sm:text-base text-[#1B1B1B] leading-relaxed whitespace-pre-line space-y-4">
                {selectedActivity.body}
              </div>

              {/* Bottom RSVP CTA */}
              <div className="pt-6 border-t border-[#D9D7D0]/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {selectedActivity.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white border border-[#D9D7D0] text-[11px] font-medium text-[#8C8880]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleToggleRsvp(selectedActivity.id, selectedActivity.title)}
                  className={`px-6 py-3 rounded-full text-xs sm:text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                    rsvpList[selectedActivity.id]
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white hover:opacity-95'
                  }`}
                >
                  {rsvpList[selectedActivity.id] ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Anda Telah Terdaftar (Batalkan)</span>
                    </>
                  ) : (
                    <>
                      <span>Konfirmasi Kehadiran (RSVP)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
