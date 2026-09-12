import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Users,
  Sparkles,
  Baby,
  UserRound,
  HeartHandshake,
  MapPin,
  Lock,
  ArrowUpRight,
  LogIn,
  Clock,
  ExternalLink,
  Palette,
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Mail,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { usePublicOrgTree } from '../../hooks/usePublicOrgTree';
import HubGalleryCarousel from './HubGalleryCarousel';
import {
  CHURCH_UNITS,
  CHURCH_GROUP_LABELS,
  DEFAULT_MAP_URL,
  CHURCH_ADDRESS,
  type ChurchUnit,
  type ChurchUnitGroup,
} from '../../data/churchUnits';

const YOUTH_PORTAL_URL = 'https://youth.gehc.page';

const UNIT_ICONS: Record<ChurchUnit['id'], LucideIcon> = {
  youth: Users,
  teen: Sparkles,
  kids: Baby,
  men: UserRound,
  women: HeartHandshake,
  districts: MapPin,
  community: Palette,
};

type Schedule = { label?: string; day?: string; time?: string };
type Socials = { instagram?: string; facebook?: string; tiktok?: string; youtube?: string };
type Profile = {
  name?: string;
  tagline?: string;
  description?: string;
  addressText?: string;
  mapShareUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsapp?: string;
  schedules?: Schedule[];
  socials?: Socials;
};

const SOCIAL_ITEMS: { key: keyof Socials; label: string; Icon: LucideIcon }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
];

const FALLBACK_SCHEDULES: Schedule[] = [
  { label: 'Ibadah Umum', day: 'Minggu', time: '10.00 WIB' },
  { label: 'Ibadah Pemuda', day: 'Minggu', time: '13.00 WIB' },
];

const CONTAINER = 'max-w-[1200px] mx-auto px-4 sm:px-8';

/**
 * Hub gereja untuk gehc.page — direktori pelayanan lintas unit.
 * Info gereja (kontak/sosial/jadwal) dari /api/church-profile; struktur BPMJ publik.
 */
const ChurchHub: React.FC = () => {
  const { brand } = useMediaSlots();
  const { data: orgTree } = usePublicOrgTree();
  const [profile, setProfile] = useState<Profile>({});

  useEffect(() => {
    document.title = 'GMIM Eben Haezer Cikarang — GEHC.page';
    fetch('/api/church-profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile) setProfile(d.profile);
      })
      .catch(() => {});
  }, []);

  const gmimLogo = brand?.logoGmim;
  const mapUrl = profile.mapShareUrl || DEFAULT_MAP_URL;
  const address = profile.addressText || CHURCH_ADDRESS;
  const schedules = profile.schedules?.length ? profile.schedules : FALLBACK_SCHEDULES;
  const socials = useMemo(
    () => SOCIAL_ITEMS.filter(({ key }) => Boolean(profile.socials?.[key])),
    [profile.socials],
  );
  const bpmj = useMemo(
    () => (orgTree?.members || []).filter((m) => m.division === 'BPMJ'),
    [orgTree],
  );

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur bg-[#FAF9F5]/85 border-b border-[#D9D7D0]">
        <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            <GehcLogo size={36} />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[11px] tracking-tight truncate">
                GMIM EBEN HAEZER
              </span>
              <span className="text-[10px] text-[#8C8880] tracking-tight truncate">
                Cikarang · Laman Hub
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#pelayanan"
              className="hidden sm:inline-flex text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B] transition-colors px-3 py-2"
            >
              Pelayanan
            </a>
            <a
              href="#/pitch"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pitch</span>
            </a>
            <a
              href={YOUTH_PORTAL_URL}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-95 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk Portal
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className={`${CONTAINER} pt-16 sm:pt-24 pb-12 relative`}>
        {gmimLogo && (
          <img
            src={gmimLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute right-0 top-4 w-[420px] max-w-[60vw] opacity-[0.05] hidden md:block"
          />
        )}
        <div className="max-w-3xl relative">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#FF416C] bg-[#FF416C]/10 px-3 py-1.5 rounded-full">
            <Landmark className="w-3.5 h-3.5" />
            Rumah Digital Jemaat
          </span>
          <h1 className="font-display text-4xl sm:text-6xl font-black leading-[1.05] mt-6">
            Satu gereja,
            <br />
            <span className="bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] bg-clip-text text-transparent">
              banyak pelayanan.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-[#8C8880] leading-relaxed mt-6 max-w-2xl">
            {profile.description ||
              'Selamat datang di laman hub GMIM Eben Haezer Cikarang. Temukan komunitas pelayanan yang tepat untuk Anda — dari anak, pra remaja, pemuda, hingga kaum bapa dan ibu, serta persekutuan wilayah/Kolom.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <a
              href="#pelayanan"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B1B1B] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-all"
            >
              Jelajahi Pelayanan
            </a>
            <a
              href="#/pitch"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
            >
              <Presentation className="w-4 h-4" />
              Lihat Presentasi
            </a>
            <a
              href={YOUTH_PORTAL_URL}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
            >
              Portal Pemuda
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Units */}
      <section id="pelayanan" className={`${CONTAINER} pb-16 scroll-mt-20`}>
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">
              Direktori
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">
              Pelayanan di GEHC
            </h2>
          </div>
          <p className="hidden sm:block text-xs text-[#8C8880] max-w-xs leading-relaxed">
            Unit yang sudah aktif punya portalnya sendiri; selebihnya sedang disiapkan.
          </p>
        </div>

        {(['bipra', 'teritorial', 'lainnya'] as ChurchUnitGroup[]).map((group) => {
          const units = CHURCH_UNITS.filter((u) => u.group === group);
          if (!units.length) return null;
          const label = CHURCH_GROUP_LABELS[group];
          return (
            <div key={group} className="mb-10 last:mb-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
                <h3 className="font-display text-lg font-black">{label.title}</h3>
                <span className="text-[11px] text-[#8C8880]">{label.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.map((unit) => {
                  const Icon = UNIT_ICONS[unit.id];
                  const active = unit.status === 'active' && Boolean(unit.host);
                  const inner = (
                    <>
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
                            active ? `bg-gradient-to-br ${unit.accent}` : 'bg-[#E9E8E4]'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#BDBAB2]'}`} />
                        </div>
                        {active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8C8880] bg-white px-2.5 py-1 rounded-full border border-[#D9D7D0]">
                            <Lock className="w-3 h-3" />
                            Coming soon
                          </span>
                        )}
                      </div>
                      <h4 className={`font-bold text-lg mt-5 ${active ? 'text-[#1B1B1B]' : 'text-[#8C8880]'}`}>
                        {unit.name}
                      </h4>
                      <p className="text-[11px] uppercase tracking-widest text-[#BDBAB2] font-bold">
                        {unit.nameEn}
                      </p>
                      <p className="text-xs text-[#8C8880] leading-relaxed mt-3 flex-1">{unit.desc}</p>
                      <div className="mt-5 flex items-center gap-1.5 text-xs font-bold">
                        {active ? (
                          <span className="text-[#FF416C] inline-flex items-center gap-1">
                            Masuk <ArrowUpRight className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-[#BDBAB2]">Segera hadir</span>
                        )}
                      </div>
                    </>
                  );

                  return active ? (
                    <a
                      key={unit.id}
                      href={`https://${unit.host}`}
                      className="group relative flex flex-col overflow-hidden rounded-[28px] bg-white border border-[#D9D7D0] p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                      <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${unit.accent}`} />
                      {inner}
                    </a>
                  ) : (
                    <div
                      key={unit.id}
                      aria-disabled="true"
                      className="flex flex-col rounded-[28px] bg-[#F3F1EC] border border-dashed border-[#D9D7D0] p-6"
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Galeri jemaat (jika ada foto di Drive) */}
      <HubGalleryCarousel />

      {/* BPMJ */}
      {bpmj.length > 0 && (
        <section className={`${CONTAINER} pb-16`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">
            Majelis Jemaat
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">
            Badan Pekerja Majelis Jemaat
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {bpmj.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 ${
                  m.isOpenRole
                    ? 'border-dashed border-[#D9D7D0] bg-transparent'
                    : 'border-[#E9E8E4] bg-white'
                }`}
              >
                <p className={`text-sm font-bold ${m.isOpenRole ? 'text-[#BDBAB2]' : 'text-[#1B1B1B]'}`}>
                  {m.name}
                </p>
                <p className="text-[11px] text-[#8C8880] mt-0.5">{m.position || '—'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Church info */}
      <section className={`${CONTAINER} pb-20`}>
        <div className="rounded-[28px] bg-[#151515] text-white p-8 sm:p-12 grid grid-cols-1 md:grid-cols-2 gap-10 relative overflow-hidden">
          {gmimLogo && (
            <img
              src={gmimLogo}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute -right-10 -bottom-10 w-[360px] opacity-[0.06]"
            />
          )}
          <div className="relative">
            <h2 className="font-display text-2xl sm:text-3xl font-black">
              {profile.name || 'Bersekutu bersama'}
            </h2>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-3">{address}</p>
            {profile.tagline && (
              <p className="text-xs italic text-white/50 mt-2">{profile.tagline}</p>
            )}
            <div className="flex flex-col gap-4 mt-8">
              {schedules.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#FF416C] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{s.label || s.day || 'Ibadah'}</p>
                    <p className="text-xs text-white/60">
                      {[s.day, s.time].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-wider transition-all"
              >
                <MapPin className="w-4 h-4 text-[#FF416C]" />
                Buka di Peta
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {profile.contactEmail && (
                <a
                  href={`mailto:${profile.contactEmail}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
                >
                  <Mail className="w-4 h-4 text-[#FF416C]" />
                  {profile.contactEmail}
                </a>
              )}
            </div>
            {socials.length > 0 && (
              <div className="flex items-center gap-2 mt-6">
                {socials.map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={profile.socials?.[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center gap-4 relative">
            <a
              href={YOUTH_PORTAL_URL}
              className="rounded-[24px] bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] p-6 hover:opacity-95 transition-all"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                Portal Komunitas
              </p>
              <p className="font-display text-xl font-black mt-1">Kunjungi Portal Pemuda</p>
              <p className="text-xs text-white/80 mt-2">
                Beyonders, rumah pemuridan, warta, dan agenda pemuda.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold mt-4">
                youth.gehc.page <ArrowUpRight className="w-4 h-4" />
              </span>
            </a>
            <div className="rounded-[24px] bg-white/5 p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                Dalam pengembangan
              </p>
              <p className="text-xs text-white/60 mt-2 leading-relaxed">
                Portal untuk anak, pra remaja, kaum bapa & ibu, serta wilayah/Kolom
                sedang disiapkan. Nantikan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#151515] text-white/50 py-8 px-4">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-2 text-center">
          {gmimLogo && (
            <img src={gmimLogo} alt="GMIM" className="w-10 h-10 object-contain opacity-70" />
          )}
          <p className="text-[11px]">
            © {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC) · gehc.page
          </p>
          <p className="text-[11px] italic">“Satu retreat, seribu generasi.”</p>
        </div>
      </footer>
    </div>
  );
};

export default ChurchHub;
