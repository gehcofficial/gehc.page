import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Folder,
  FileText,
  Image,
  TrendingUp,
  Sparkles,
  Users,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const EcosystemPillars: React.FC = () => {
  const { setPublicTab, setActiveView } = useApp();

  return (
    <div className="space-y-16 sm:space-y-24 max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
      
      {/* 1. Pillar 1: Digital Foundation & Centralized Knowledge */}
      <section className="bg-[#FAF9F5]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Visual Container */}
          <div className="bg-gradient-to-br from-[#F4F3EF] to-[#E9E8E4] rounded-[32px] sm:rounded-[44px] p-6 sm:p-10 h-[480px] sm:h-[560px] flex items-center justify-center relative overflow-hidden border border-[#D9D7D0]/40 shadow-sm">
            <div className="w-full max-w-md bg-[#FFFDF8] rounded-3xl shadow-xl border border-[#D9D7D0]/40 p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#D9D7D0]/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <span className="text-xs font-bold text-[#1B1B1B] ml-2">GEHC Cloud Files</span>
                </div>
                <span className="text-[10px] text-[#8C8880] font-mono">Google Drive Live</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 hover:bg-[#F0EFEB] rounded-2xl transition-colors cursor-pointer">
                  <div className="p-2 rounded-xl bg-orange-100 text-[#FF4B2B]">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1B1B1B] truncate">Warta_Pemuda_Mingguan_2026</p>
                    <p className="text-[10px] text-[#8C8880]">36 PDF Bulletins</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 hover:bg-[#F0EFEB] rounded-2xl transition-colors cursor-pointer">
                  <div className="p-2 rounded-xl bg-purple-100 text-[#8A2387]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1B1B1B] truncate">Kurikulum_10_Kelompok_PA</p>
                    <p className="text-[10px] text-[#8C8880]">Modul Pembinaan & Pemuridan</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 hover:bg-[#F0EFEB] rounded-2xl transition-colors cursor-pointer">
                  <div className="p-2 rounded-xl bg-pink-100 text-[#E94057]">
                    <Image className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1B1B1B] truncate">Youth_Creative_Night_Assets</p>
                    <p className="text-[10px] text-[#8C8880]">High-Res Posters & Videos</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 hover:bg-[#F0EFEB] rounded-2xl transition-colors cursor-pointer">
                  <div className="p-2 rounded-xl bg-amber-100 text-[#F27121]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1B1B1B] truncate">Laporan_Monitoring_SmallGroups</p>
                    <p className="text-[10px] text-[#8C8880]">Extensible JSON Metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Description */}
          <div className="flex flex-col justify-center h-full max-w-lg">
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1B1B] mb-8 font-display">
              Pusat Data Terpadu & Ekosistem Pemuda
            </h3>

            <div className="relative pl-6 border-l-2 border-[#D9D7D0] space-y-8">
              <div className="absolute left-[-2px] top-0 w-[2px] h-1/3 bg-gradient-to-b from-[#FF416C] to-[#FF4B2B]"></div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF416C]" />
                  Sentralisasi Informasi Gerejawi
                </h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Menyatukan seluruh warta jemaat, materi pemuridan, panduan ibadah kreatif, dan data anggota ke dalam satu platform digital yang mudah diakses.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF416C]" />
                  Monitoring 10 Kelompok Berbasis Mentor
                </h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Fasilitator kelompok dapat mencatat kehadiran, pokok doa, dan kebutuhan konseling rohani secara mandiri dengan keamanan data terjaga.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FF416C]" />
                  Role-Based Access Control (RBAC)
                </h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Hierarki peran yang jelas antara Superadmin, Komisi Pemuda (Committee), Mentor Kelompok, dan Anggota (Menti).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Pillar 2: Dynamic Content Management & Multi-Tenant Vision */}
      <section className="bg-[#FAF9F5] pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* Text Description (Left on Desktop) */}
          <div className="flex flex-col justify-center h-full max-w-lg order-2 lg:order-1">
            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1B1B] mb-8 font-display">
              Manajemen Konten Cepat & Fondasi Multi-Tenant
            </h3>

            <div className="relative pl-6 border-l-2 border-[#D9D7D0] space-y-8">
              <div className="absolute left-[-2px] top-0 w-[2px] h-1/4 bg-gradient-to-b from-[#FF416C] to-[#FF4B2B]"></div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2">Penerbitan Warta Real-Time</h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Komisi Pemuda dapat langsung menyunting artikel warta, ayat renungan, dan agenda kegiatan tanpa membutuhkan intervensi pengembang teknis.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2">Arsitektur Multi-Subdomain</h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Dirancang siap scale untuk menaungi ekosistem P/KB (Bapak), W/KI (Ibu), Komunitas Rekreasional, dan 12 Kolom Teritorial GMIM Eben Haezer Cikarang.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#1B1B1B] mb-2">Jembatan Google Drive</h4>
                <p className="text-sm text-[#8C8880] leading-relaxed">
                  Integrasi cloud storage untuk penyimpanan flyer kegiatan, dokumentasi foto resolusi tinggi, dan bulletin PDF.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => setActiveView('portal')}
                className="px-6 py-3 rounded-full bg-[#181818] hover:bg-black text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition-all"
              >
                <span>Kelola di Portal Pengurus</span>
                <ArrowRight className="w-4 h-4 text-[#FF416C]" />
              </button>
            </div>
          </div>

          {/* Visual Container (Right on Desktop) */}
          <div className="bg-gradient-to-tr from-[#E0EAFC] to-[#CFDEF3] rounded-[32px] sm:rounded-[44px] p-6 sm:p-10 h-[480px] sm:h-[560px] flex items-center justify-center relative overflow-hidden border border-[#D9D7D0]/40 shadow-inner order-1 lg:order-2">
            <div className="w-full max-w-lg bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/60">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white font-bold text-xs shadow-md">
                  G
                </div>
                <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">
                  GEHC DYNAMIC CMS
                </span>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/60 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#1B1B1B]">
                  <span>Draft: Warta Pemuda Minggu IV</span>
                  <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Ready to Publish</span>
                </div>
                <p className="text-xs text-[#1B1B1B]/80 italic">
                  "Berakar, Bertumbuh & Berbuah dalam Kebenaran (Kolose 2:6-7)"
                </p>
                <div className="text-[10px] text-[#8C8880] flex items-center gap-2">
                  <span>Autor: Komisi Pemuda</span>
                  <span>•</span>
                  <span>Target: Seluruh Jemaat</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-[#8C8880]">Terhubung ke youth.gehc.page</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shadow-md text-white animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
