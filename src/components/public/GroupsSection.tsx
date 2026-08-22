import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { YouthGroup } from '../../types';
import {
  Users,
  Calendar,
  MapPin,
  BookOpen,
  Sparkles,
  Search,
  CheckCircle2,
  Heart,
  MessageCircle,
  X,
} from 'lucide-react';

export const GroupsSection: React.FC = () => {
  const { groups, addToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<YouthGroup | null>(null);

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.meetingLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.mentorNames.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-[1440px] mx-auto">
      
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 border-b border-[#D9D7D0]/60 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D9D7D0] mb-3">
            <Users className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              10 Kelompok Sel & Pemuridan Pemuda
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1B1B1B] font-display">
            Kelompok Persekutuan Pemuda
          </h2>
          <p className="text-sm sm:text-base text-[#8C8880] mt-2 max-w-2xl">
            Membangun komunitas kecil yang saling mendoakan, belajar firman bersama, dan bertumbuh dalam karakter Kristus.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8880]" />
          <input
            type="text"
            placeholder="Cari kelompok, mentor, atau lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* 10 Groups Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredGroups.map((grp) => (
          <div
            key={grp.id}
            onClick={() => setSelectedGroup(grp)}
            className="group bg-white rounded-[32px] p-6 sm:p-7 border border-[#D9D7D0]/50 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md font-bold text-lg"
                    style={{ backgroundColor: grp.color }}
                  >
                    {grp.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1B1B1B] group-hover:text-[#FF416C] transition-colors">
                      {grp.name}
                    </h3>
                    <p className="text-xs text-[#8C8880] font-medium line-clamp-1">
                      {grp.meaning}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[10px] font-bold text-[#1B1B1B]">
                  {grp.memberCount} Anggota
                </span>
              </div>

              {/* Scripture Quotation Card */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/50 text-xs text-[#1B1B1B]/90 italic mb-4 line-clamp-2">
                "{grp.scripture}"
              </div>

              {/* Description */}
              <p className="text-xs text-[#8C8880] line-clamp-2 mb-5 leading-relaxed">
                {grp.description}
              </p>

              {/* Meta Info */}
              <div className="space-y-2 py-3 border-t border-[#D9D7D0]/40 text-xs text-[#1B1B1B]">
                <div className="flex items-center gap-2 text-[#8C8880]">
                  <Calendar className="w-3.5 h-3.5 text-[#FF416C] shrink-0" />
                  <span className="truncate">{grp.meetingSchedule}</span>
                </div>
                <div className="flex items-center gap-2 text-[#8C8880]">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{grp.meetingLocation}</span>
                </div>
              </div>
            </div>

            {/* Card Footer: Mentors & Join Button */}
            <div className="pt-4 border-t border-[#D9D7D0]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#8C8880] font-bold uppercase block">Mentor</span>
                <span className="text-xs font-bold text-[#1B1B1B] truncate max-w-[150px] inline-block">
                  {grp.mentorNames.join(', ')}
                </span>
              </div>

              <span className="text-xs font-bold text-[#1B1B1B] group-hover:text-[#FF416C] flex items-center gap-1">
                Detail Kelompok →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Group Detail Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0] relative flex flex-col">
            
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow"
                  style={{ backgroundColor: selectedGroup.color }}
                >
                  {selectedGroup.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B1B1B]">Grup {selectedGroup.name}</h3>
                  <span className="text-[10px] text-[#8C8880]">GMIM Eben Haezer Cikarang</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Meaning and Banner */}
              <div className="p-6 rounded-3xl bg-white border border-[#D9D7D0] shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
                  Makna Nama & Nilai Kelompok
                </span>
                <h4 className="text-xl font-bold text-[#1B1B1B] mt-1 mb-2">
                  {selectedGroup.meaning}
                </h4>
                <p className="text-xs sm:text-sm text-[#8C8880] leading-relaxed">
                  {selectedGroup.description}
                </p>
              </div>

              {/* Scripture */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 text-xs sm:text-sm text-[#1B1B1B] italic">
                <span className="font-bold block not-italic text-[#FF416C] text-[10px] uppercase mb-1">
                  Landasan Firman Tuhan
                </span>
                "{selectedGroup.scripture}"
              </div>

              {/* Schedule and Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white border border-[#D9D7D0]">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#8C8880]">Jadwal Pertemuan</span>
                  <p className="text-xs font-semibold text-[#1B1B1B]">{selectedGroup.meetingSchedule}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#8C8880]">Titik Kumpul / Lokasi</span>
                  <p className="text-xs font-semibold text-[#1B1B1B]">{selectedGroup.meetingLocation}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#8C8880]">Mentor Pendamping</span>
                  <p className="text-xs font-semibold text-[#1B1B1B]">{selectedGroup.mentorNames.join(', ')}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#8C8880]">Total Anggota Aktif</span>
                  <p className="text-xs font-semibold text-[#1B1B1B]">{selectedGroup.memberCount} Pemuda</p>
                </div>
              </div>

              {/* CTA to Connect */}
              <div className="pt-4 border-t border-[#D9D7D0]/60 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-[#8C8880]">
                  Ingin bergabung atau membutuhkan konseling? Hubungi mentor grup.
                </p>

                <button
                  onClick={() => {
                    addToast({
                      type: 'success',
                      title: 'Permintaan Terkirim',
                      description: `Pesan minat telah diteruskan ke mentor ${selectedGroup.mentorNames[0]}.`,
                    });
                    setSelectedGroup(null);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Hubungi Mentor Kelompok</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
