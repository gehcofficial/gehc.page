import React from 'react';
import { useApp } from '../../context/AppContext';
import { MEDIA, IMG_PROPS } from '../../config/media';
import {
  Sparkles,
  RefreshCw,
  Music,
  Radio,
  Heart,
  TrendingUp,
} from 'lucide-react';

export const VisualCollage: React.FC = () => {
  const { groups, monitoringRecords, setPublicTab } = useApp();

  return (
    <section className="min-h-[920px] sm:min-h-[1100px] lg:min-h-[1280px] w-full max-w-[1440px] mx-auto relative overflow-hidden bg-[#FAF9F5] py-16 px-4">
      {/* Central Typography Anchor */}
      <div className="absolute inset-0 flex justify-center items-center opacity-90 pointer-events-none z-0">
        <h2 className="text-[72px] sm:text-[100px] md:text-[130px] lg:text-[150px] font-black text-[#1B1B1B]/10 tracking-tighter leading-[0.88] text-center select-none font-display">
          GEHC<br />YOUTH
        </h2>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto h-[860px] sm:h-[1020px] lg:h-[1180px]">
        
        {/* 1. Top-Left: Image with Glass UI Overlay (Monitoring Status) */}
        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ left: '4%', top: '4%', width: 'min(380px, 85%)', height: '270px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={MEDIA.collageWorship}
              loading="lazy"
              decoding="async"
            alt="Worship Fellowship"
          />
          <div className="absolute bottom-4 left-4 right-4 bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-3 shadow-lg text-left">
            <p className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ibadah Kreatif Pemuda
            </p>
            <p className="text-[11px] text-[#8C8880] mt-0.5 leading-snug">
              Setiap Sabtu 18:30 WIB — terbuka bagi pelajar & pekerja muda.
            </p>
          </div>
        </div>

        {/* 2. Top-Right: Tall Card with Image & Glow */}
        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl hidden sm:block"
          style={{ right: '6%', top: '6%', width: '290px', height: '340px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={MEDIA.collageCommunity}
              loading="lazy"
              decoding="async"
            alt="Youth Choir and Praise"
          />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-[#FF416C]" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-2.5 text-white">
            <p className="text-[11px] font-bold">Praise & Worship Team</p>
            <p className="text-[9px] text-white/70">Ruach Ministry • Musik & Vokal</p>
          </div>
        </div>

        {/* 3. Mid-Left: Floating Glass UI with Auto-Sync */}
        <div
          className="absolute rounded-[24px] overflow-hidden bg-white/80 backdrop-blur-3xl border border-white/80 shadow-2xl flex flex-col p-4 z-20"
          style={{ left: '2%', top: '38%', width: 'min(280px, 90%)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#1B1B1B]">Satu Keluarga</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">
              Since 2026
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shadow-md text-white">
              <Heart className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-[#1B1B1B]">3 Kolom • 5 Fungsi • 10 Grup</span>
              <span className="text-[10px] text-[#8C8880]">Satu panggilan, banyak wujud pelayanan</span>
            </div>
          </div>
        </div>

        {/* 4. Mid-Right: Music & Worship Card */}
        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ right: '4%', top: '42%', width: 'min(330px, 88%)', height: '230px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={MEDIA.collageMusic}
              loading="lazy"
              decoding="async"
            alt="Creative Ministry"
          />
          <div className="absolute top-4 left-4 bg-white/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/60 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            <span className="text-[10px] font-bold text-[#1B1B1B] uppercase tracking-wider">
              Liturgi & Ibadah Kreatif
            </span>
          </div>
        </div>

        {/* 5. Bottom-Left: Large Image with Scripture Theme */}
        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl hidden sm:block"
          style={{ left: '10%', top: '65%', width: '380px', height: '260px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={MEDIA.collageStudy}
              loading="lazy"
              decoding="async"
            alt="Small Group Fellowship"
          />
          <div className="absolute bottom-4 left-4 bg-white/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/60 shadow-sm flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[10px] font-bold text-[#1B1B1B] uppercase tracking-wider">
              1 Timotius 4:12 — Jadi Teladan
            </span>
          </div>
        </div>

        {/* 6. Bottom-Right: Wide Image */}
        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ right: '8%', top: '68%', width: 'min(360px, 85%)', height: '240px' }}
        >
          <img
            className="w-full h-full object-cover opacity-95"
            src={MEDIA.collageFriends}
              loading="lazy"
              decoding="async"
            alt="Community Prayer"
          />
          <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md rounded-xl p-2 text-white text-left">
            <p className="text-xs font-bold">Avodah • Logos • Dunamis</p>
            <p className="text-[10px] text-white/70">Persekutuan Kolom & Small Groups</p>
          </div>
        </div>

        {/* 7. Floating Comment / Member Testimonial */}
        <div
          className="absolute bg-white/85 backdrop-blur-3xl rounded-[24px] flex items-center gap-3 p-3 shadow-2xl border border-white/80 z-30"
          style={{ left: '50%', transform: 'translateX(-50%)', top: '82%', width: 'max-content', maxWidth: '90%' }}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm border border-[#D9D7D0] shrink-0">
            <img
              className="w-full h-full object-cover"
              src={MEDIA.collagePortrait}
              loading="lazy"
              decoding="async"
              alt="Andrea Sondakh"
            />
          </div>
          <div className="flex flex-col pr-3">
            <span className="text-[11px] text-[#1B1B1B] font-bold">Andrea Sondakh (Kelompok Logos)</span>
            <span className="text-[12px] text-[#1B1B1B]/80 font-medium leading-tight">
              "Persekutuan pemuda GEHC sangat menguatkan iman saya di perantauan Cikarang!"
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
