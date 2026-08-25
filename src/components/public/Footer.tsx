import React from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { MapPin, Phone, Mail, Globe, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setPublicTab, setActiveView } = useApp();
  const { t } = useLang();

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
                <p className="text-xs text-white/50">Beyonders • GEHC Youth</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              {t.footer.desc}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-white/70 font-bold">
                Beyond the Sunday Walk
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              {t.footer.menuTitle}
            </h4>
            <ul className="flex flex-col gap-3 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => setPublicTab('home')}
                  className="text-white/60 hover:text-white transition-colors"
                >{t.nav.beyonders}</button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('bulletin')}
                  className="text-white/60 hover:text-white transition-colors"
                >{t.nav.bulletin}</button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('events')}
                  className="text-white/60 hover:text-white transition-colors"
                >{t.nav.events}</button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('beyonders')}
                  className="text-white/60 hover:text-white transition-colors"
                >{t.nav.beyonders}</button>
              </li>
              <li>
                <button
                  onClick={() => setPublicTab('leaders')}
                  className="text-white/60 hover:text-white transition-colors"
                >{t.nav.leaders}</button>
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
                <p className="font-bold text-white">{t.footer.sched2n}</p>
                <p className="text-white/60">{t.footer.sched2d}</p>
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
              {t.footer.portalDesc}
            </p>
            <button
              onClick={() => setActiveView('portal')}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <span>{t.footer.portalBtn}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-white/40">
          <p>© {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC). All rights reserved.</p>
          <p className="italic">{t.footer.lineage}</p>
        </div>
      </div>
    </footer>
  );
};
