import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { MapPin, ArrowUpRight, ExternalLink } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';

const DEFAULT_MAP = 'https://share.google/Ro2jBSuGfrzfg49nP';

export const Footer: React.FC = () => {
  const { setPublicTab, setActiveView } = useApp();
  const { t } = useLang();
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.gehcMapUrl) setMapUrl(d.gehcMapUrl);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-[#151515] text-white pt-16 sm:pt-24 pb-12 px-4 sm:px-8 rounded-t-[44px] sm:rounded-t-[64px] relative z-20 mt-16">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-16 mb-16">
          
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <GehcLogo size={40} />
              <BrandCaption />
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

          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              {t.footer.menuTitle}
            </h4>
            <ul className="flex flex-col gap-3 text-xs sm:text-sm">
              {([
                ['beyonders', t.nav.beyonders],
                ['leaders', t.nav.leaders],
                ['events', t.nav.events],
                ['bulletin', t.nav.bulletin],
                ['benzarpreneurship', t.nav.benzarpreneurship],
              ] as const).map(([tab, label]) => (
                <li key={tab}>
                  <button
                    onClick={() => setPublicTab(tab)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              {t.footer.schedTitle}
            </h4>
            <div className="space-y-4 text-xs text-white/70">
              <div>
                <p className="font-bold text-white">{t.footer.sched2n}</p>
                <p className="text-white/60">{t.footer.sched2d}</p>
              </div>
              <div>
                <p className="font-bold text-white">{t.footer.sched1n}</p>
                <p className="text-white/60">{t.footer.sched1d}</p>
              </div>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pt-2 flex items-start gap-2 group hover:text-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#FF416C] mt-0.5 shrink-0" />
                <span className="leading-snug text-[11px] text-white/60 group-hover:text-white/90">
                  {t.footer.addr}
                  <span className="inline-flex items-center gap-1 ml-1 text-[#FF416C] font-bold">
                    {t.footer.mapCta}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </span>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">
              {t.footer.portalTitle}
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

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-white/40">
          <p>© {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC). All rights reserved.</p>
          <p className="italic">{t.footer.lineage}</p>
        </div>
      </div>
    </footer>
  );
};
