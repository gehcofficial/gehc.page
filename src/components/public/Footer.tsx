import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { MapPin, ArrowUpRight, ExternalLink, Mail, MessageCircle, Phone, Instagram, Facebook, Youtube, Music2 } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';
import { useMediaSlots } from '../../hooks/useMediaSlots';

const DEFAULT_MAP = 'https://share.google/Ro2jBSuGfrzfg49nP';

type ScheduleRow = { label?: string; day?: string; time?: string };
type ChurchProfile = {
  name?: string;
  addressText?: string;
  mapShareUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsapp?: string;
  schedules?: ScheduleRow[];
  socials?: Record<string, string>;
};
type UnitProfile = { tagline?: string; contactEmail?: string; socials?: Record<string, string> };

const SOCIAL_ITEMS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'instagram', label: 'Instagram', icon: <Instagram className="w-4 h-4" /> },
  { key: 'facebook', label: 'Facebook', icon: <Facebook className="w-4 h-4" /> },
  { key: 'tiktok', label: 'TikTok', icon: <Music2 className="w-4 h-4" /> },
  { key: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
];

function waHref(v?: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const digits = s.replace(/[^\d]/g, '').replace(/^0/, '62');
  return digits ? `https://wa.me/${digits}` : null;
}

export const Footer: React.FC = () => {
  const { setPublicTab, setActiveView } = useApp();
  const { t } = useLang();
  const { brand } = useMediaSlots();
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP);
  const [profile, setProfile] = useState<ChurchProfile>({});
  const [unit, setUnit] = useState<UnitProfile>({});

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.gehcMapUrl) setMapUrl(d.gehcMapUrl);
      })
      .catch(() => {});
    fetch('/api/church-profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.profile) setProfile(d.profile); })
      .catch(() => {});
    fetch('/api/tenants/youth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tenant) setUnit(d.tenant); })
      .catch(() => {});
  }, []);

  const schedules = (profile.schedules || []).filter((s) => s?.label || s?.day || s?.time).slice(0, 4);
  const address = profile.addressText || t.footer.addr;
  const mapLink = profile.mapShareUrl || mapUrl || DEFAULT_MAP;
  const socials = { ...(unit.socials || {}), ...(profile.socials || {}) };
  const socialItems = SOCIAL_ITEMS.filter((s) => Boolean(socials[s.key]));
  const email = profile.contactEmail || unit.contactEmail || '';
  const wa = waHref(profile.whatsapp);
  const phone = profile.contactPhone || '';

  return (
    <footer className="bg-[#151515] text-white pt-16 sm:pt-24 pb-12 px-4 sm:px-8 rounded-t-[44px] sm:rounded-t-[64px] relative z-20 mt-16">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-16 mb-16">
          
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <GehcLogo size={40} />
              {brand?.logoYouthGmim && (
                <img
                  src={brand.logoYouthGmim}
                  alt="Pemuda GMIM"
                  className="w-10 h-10 object-contain shrink-0"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <BrandCaption />
            </div>

            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              {t.footer.desc}
            </p>

            {socialItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {socialItems.map((s) => (
                  <a
                    key={s.key}
                    href={socials[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}

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
              {schedules.length > 0 ? (
                schedules.map((s, i) => (
                  <div key={i}>
                    {s.label && <p className="font-bold text-white">{s.label}</p>}
                    <p className="text-white/60">{[s.day, s.time].filter(Boolean).join(', ')}</p>
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <p className="font-bold text-white">{t.footer.sched2n}</p>
                    <p className="text-white/60">{t.footer.sched2d}</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">{t.footer.sched1n}</p>
                    <p className="text-white/60">{t.footer.sched1d}</p>
                  </div>
                </>
              )}
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="pt-2 flex items-start gap-2 group hover:text-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#FF416C] mt-0.5 shrink-0" />
                <span className="leading-snug text-[11px] text-white/60 group-hover:text-white/90 whitespace-pre-line">
                  {address}
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

            {(email || wa || phone) && (
              <div className="mt-5 flex flex-col gap-2 text-[11px]">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5 text-[#FF416C]" /> {email}
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <MessageCircle className="w-3.5 h-3.5 text-[#FF416C]" /> WhatsApp
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <Phone className="w-3.5 h-3.5 text-[#FF416C]" /> {phone}
                  </a>
                )}
              </div>
            )}

            <p className="text-[11px] text-white/45 mt-4 leading-relaxed">
              {t.portal.pwaInstall.body}
            </p>
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
