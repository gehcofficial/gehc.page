import React, { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { IMG_PROPS, slugifyPerson } from '../../config/media';
import { Sparkles, Radio, Heart } from 'lucide-react';

interface PublicTestimonial {
  id: string;
  authorName: string;
  groupName?: string | null;
  quote: string;
  photoUrl?: string | null;
}

const ROTATE_MS = 7000;

export const VisualCollage: React.FC = () => {
  const { t } = useLang();
  const slots = useMediaSlots();
  const media = slots.landing;
  const c = t.collage;
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/testimonials/public')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled && Array.isArray(d.items)) setTestimonials(d.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (testimonials.length < 2) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % testimonials.length);
        setFade(true);
      }, 280);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const current = testimonials[idx];
  const displayName = current
    ? current.groupName
      ? `${current.authorName} (${current.groupName})`
      : current.authorName
    : null;

  return (
    <section className="min-h-[920px] sm:min-h-[1100px] lg:min-h-[1280px] w-full max-w-[1440px] mx-auto relative overflow-hidden bg-[#FAF9F5] py-16 px-4">
      <div className="absolute inset-0 flex justify-center items-center opacity-90 pointer-events-none z-0">
        <h2 className="text-[72px] sm:text-[100px] md:text-[130px] lg:text-[150px] font-black text-[#1B1B1B]/10 tracking-tighter leading-[0.88] text-center select-none font-display">
          GEHC<br />YOUTH
        </h2>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto h-[860px] sm:h-[1020px] lg:h-[1180px]">

        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ left: '4%', top: '4%', width: 'min(380px, 85%)', height: '270px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={media.collageWorship}
            {...IMG_PROPS}
            alt={c.worshipTitle}
          />
          <div className="absolute bottom-4 left-4 right-4 bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-3 shadow-lg text-left">
            <p className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {c.worshipTitle}
            </p>
            <p className="text-[11px] text-[#8C8880] mt-0.5 leading-snug">{c.worshipDesc}</p>
          </div>
        </div>

        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl hidden sm:block"
          style={{ right: '6%', top: '6%', width: '290px', height: '340px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={media.collageCommunity}
            {...IMG_PROPS}
            alt={c.praiseTitle}
          />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/60 backdrop-blur-md border border-white/70 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-[#FF416C]" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-2.5 text-white">
            <p className="text-[11px] font-bold">{c.praiseTitle}</p>
            <p className="text-[9px] text-white/70">{c.praiseSub}</p>
          </div>
        </div>

        <div
          className="absolute rounded-[24px] overflow-hidden bg-white/80 backdrop-blur-3xl border border-white/80 shadow-2xl flex flex-col p-4 z-20"
          style={{ left: '2%', top: '38%', width: 'min(280px, 90%)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#1B1B1B]">{c.familyTitle}</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">
              {c.since}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shadow-md text-white">
              <Heart className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-[#1B1B1B]">{c.pillars}</span>
              <span className="text-[10px] text-[#8C8880]">{c.pillarsSub}</span>
            </div>
          </div>
        </div>

        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ right: '4%', top: '42%', width: 'min(330px, 88%)', height: '230px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={media.collageMusic}
            {...IMG_PROPS}
            alt={c.liturgy}
          />
          <div className="absolute top-4 left-4 bg-white/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/60 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            <span className="text-[10px] font-bold text-[#1B1B1B] uppercase tracking-wider">
              {c.liturgy}
            </span>
          </div>
        </div>

        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl hidden sm:block"
          style={{ left: '10%', top: '65%', width: '380px', height: '260px' }}
        >
          <img
            className="w-full h-full object-cover"
            src={media.collageStudy}
            {...IMG_PROPS}
            alt={c.scripture}
          />
          <div className="absolute bottom-4 left-4 bg-white/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/60 shadow-sm flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[10px] font-bold text-[#1B1B1B] uppercase tracking-wider">
              {c.scripture}
            </span>
          </div>
        </div>

        <div
          className="absolute rounded-[28px] sm:rounded-[36px] overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl"
          style={{ right: '8%', top: '68%', width: 'min(360px, 85%)', height: '240px' }}
        >
          <img
            className="w-full h-full object-cover opacity-95"
            src={media.collageFriends}
            {...IMG_PROPS}
            alt={c.groups}
          />
          <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md rounded-xl p-2 text-white text-left">
            <p className="text-xs font-bold">{c.groups}</p>
            <p className="text-[10px] text-white/70">{c.groupsSub}</p>
          </div>
        </div>

        {current && displayName && (
          <div
            className={`absolute bg-white/85 backdrop-blur-3xl rounded-[24px] flex items-center gap-3 p-3 shadow-2xl border border-white/80 z-30 transition-opacity duration-300 ${
              fade ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ left: '50%', transform: 'translateX(-50%)', top: '82%', width: 'max-content', maxWidth: '90%' }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm border border-[#D9D7D0] shrink-0 bg-[#F0EFEB]">
              <img
                className="w-full h-full object-cover"
                src={
                  current.photoUrl ||
                  slots.testimoni[slugifyPerson(current.authorName)] ||
                  media.collagePortrait
                }
                {...IMG_PROPS}
                alt={displayName}
              />
            </div>
            <div className="flex flex-col pr-3 max-w-[280px] sm:max-w-md">
              <span className="text-[11px] text-[#1B1B1B] font-bold">{displayName}</span>
              <span className="text-[12px] text-[#1B1B1B]/80 font-medium leading-tight line-clamp-2">
                {current.quote}
              </span>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
