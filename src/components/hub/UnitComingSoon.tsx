import React, { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, Lock } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { CHURCH_UNITS } from '../../data/churchUnits';
import type { HostUnit } from '../../lib/host-context';

const YOUTH_PORTAL_URL = 'https://youth.gehc.page';
const HUB_URL = 'https://gehc.page';

/**
 * Halaman sementara untuk subdomain unit yang belum dibuka
 * (teen/kids/men/women/districts/community).
 */
const UnitComingSoon: React.FC<{ unit: HostUnit }> = ({ unit }) => {
  const info = CHURCH_UNITS.find((u) => u.id === unit);

  useEffect(() => {
    if (info) document.title = `${info.name} — Segera Hadir | GMIM Eben Haezer Cikarang`;
  }, [info]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] flex flex-col">
      <header className="border-b border-[#D9D7D0]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-3">
          <GehcLogo size={36} />
          <div className="flex flex-col">
            <span className="font-bold text-[11px] tracking-tight">GMIM EBEN HAEZER</span>
            <span className="text-[10px] text-[#8C8880]">Cikarang</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg text-center py-20">
          <div
            className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${
              info?.accent || 'from-[#FF416C] to-[#FF4B2B]'
            } flex items-center justify-center shadow-lg`}
          >
            <Lock className="w-6 h-6 text-white" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF416C] mt-6">
            {info?.nameEn || 'Unit'} · Coming soon
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-black mt-2">
            {info?.name || 'Pelayanan ini'} segera hadir
          </h1>
          <p className="text-sm text-[#8C8880] leading-relaxed mt-4">
            Portal untuk unit ini sedang disiapkan. Sementara itu, kunjungi laman hub gereja
            atau portal Pemuda yang sudah aktif.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <a
              href={HUB_URL}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#1B1B1B] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Laman Hub
            </a>
            <a
              href={YOUTH_PORTAL_URL}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
            >
              Portal Pemuda
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#D9D7D0] py-6 text-center text-[11px] text-[#8C8880]">
        © {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC)
      </footer>
    </div>
  );
};

export default UnitComingSoon;
