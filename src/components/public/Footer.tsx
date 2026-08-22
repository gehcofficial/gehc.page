import React from 'react';
import { useApp } from '../../context/AppContext';
import { MapPin, Phone, Mail, Globe, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setPublicTab, setActiveView, currentTenant } = useApp();

  return (
    <footer className="bg-[#151515] text-white pt-16 sm:pt-24 pb-12 px-4 sm:px-8 rounded-t-[44px] sm:rounded-t-[64px] relative z-20 mt-16">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-16 mb-16">
          
          {/* Brand Column */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-white font-black text-sm leading-none">GEHC</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">GMIM EBEN HAEZER</h4>
                <p className="text-xs text-white/50">Cikarang Digital Ecosystem</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              Ekosistem digital terpadu Komisi Pelayanan Pemuda GMIM Eben Haezer Cikarang. Menghubungkan persekutuan, ibadah kreatif, dan 10 kelompok sel pemuda.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-emerald-400 font-bold">
                ● Tenant Active: youth.gehc.page
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              Menu Publik
            </h4>
            <ul className="flex flex-col gap-3 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => setPublicTab('home')}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Beranda Utama
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('weekly-info')}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Warta Pemuda & Renungan
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('activity')}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Agenda & Kegiatan Pemuda
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('groups')}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Direktori 10 Kelompok
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('struktur')}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Struktur Pengurus Komisi
                </button>
              </li>
            </ul>
          </div>

          {/* Worship & Location */}
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              Jadwal Ibadah & Lokasi
            </h4>
            <div className="space-y-4 text-xs text-white/70">
              <div>
                <p className="font-bold text-white">Ibadah Pemuda Kreatif</p>
                <p className="text-white/60">Setiap Sabtu, Pkl 18:30 WIB</p>
              </div>
              <div>
                <p className="font-bold text-white">Ibadah Raya Minggu</p>
                <p className="text-white/60">Sesi I: 06:30 WIB | Sesi II: 09:00 WIB</p>
              </div>
              <div className="pt-2 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FF416C] mt-0.5 shrink-0" />
                <span className="leading-snug text-[11px] text-white/60">
                  Gereja GMIM Eben Haezer Cikarang, Jl. Kasuari No. 12, Cikarang Baru, Kab. Bekasi, Jawa Barat
                </span>
              </div>
            </div>
          </div>

          {/* User Portal Access */}
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              Administrasi & Portal
            </h4>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">
              Akses modul pengelolaan warta, monitoring kelompok kecil oleh mentor, dan pengaturan integrasi cloud.
            </p>
            <button
              onClick={() => setActiveView('portal')}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <span>Masuk User Portal</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-white/40">
          <p>© {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC). All rights reserved.</p>
          <div className="flex gap-6">
            <span>Multi-Tenant Architecture</span>
            <span>Vite + React</span>
            <span>RBAC Security Matrix</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
