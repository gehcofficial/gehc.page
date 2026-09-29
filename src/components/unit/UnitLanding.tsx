import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  ExternalLink,
  Facebook,
  Instagram,
  LogIn,
  Mail,
  MapPin,
  Music2,
  Sparkles,
  UserPlus,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { useLandingMedia } from '../../hooks/useLandingMedia';
import { usePortalTheme } from '../../hooks/usePortalTheme';
import { CHURCH_UNITS, DEFAULT_MAP_URL } from '../../data/churchUnits';
import { resolvePortalId, type PortalId } from '../../lib/portal-profiles';

type Socials = { instagram?: string; facebook?: string; tiktok?: string; youtube?: string };
type Schedule = { label?: string | null; day?: string | null; time?: string | null };

type LandingResponse = {
  unit?: { id?: string; tenantId?: string; bipra?: string | null };
  tenant?: {
    slug?: string;
    name?: string;
    tagline?: string | null;
    description?: string | null;
    contactEmail?: string | null;
    socials?: Socials;
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    schedules?: Schedule[];
    registrationOpen?: boolean;
    defaultBipra?: string | null;
  } | null;
  church?: {
    name?: string | null;
    addressText?: string | null;
    mapShareUrl?: string | null;
    contactEmail?: string | null;
    schedules?: Schedule[];
    socials?: Socials;
  } | null;
};

type Pengurus = {
  id: string;
  name: string;
  position?: string | null;
  subdivision?: string | null;
  photoUrl?: string | null;
  isOpenRole?: boolean;
};

type UnitEvent = {
  id: string;
  name?: string;
  slug?: string;
  status?: string;
  startDate?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
};

type GalleryItem = {
  id: string;
  title?: string;
  mediaUrl?: string;
  thumbUrl?: string | null;
  mediaType?: string;
};

const PORTAL_TO_UNIT: Partial<Record<PortalId, string>> = {
  men: 'men',
  women: 'women',
  teen: 'teen',
  kids: 'kids',
  kolom: 'districts',
  community: 'community',
};

const SOCIAL_ITEMS: { key: keyof Socials; label: string; Icon: LucideIcon }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
];

const CONTAINER = 'max-w-[1200px] mx-auto px-4 sm:px-8';

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const UnitLanding: React.FC = () => {
  const theme = usePortalTheme();
  const { brand } = useMediaSlots();
  const landing = useLandingMedia();

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const portalId = resolvePortalId(host, search);
  const unitId = PORTAL_TO_UNIT[portalId] || 'men';
  const fallbackUnit = useMemo(() => CHURCH_UNITS.find((u) => u.id === unitId), [unitId]);

  const [data, setData] = useState<LandingResponse>({});
  const [pengurus, setPengurus] = useState<Pengurus[]>([]);
  const [events, setEvents] = useState<UnitEvent[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const query = portalId ? `?portal=${portalId}` : '';

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/unit/landing${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setData(d || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);

  const slug = data.tenant?.slug;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/units/${encodeURIComponent(slug)}/pengurus`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setPengurus(Array.isArray(d?.members) ? d.members : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events?status=ACTIVE,PLANNING')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setEvents(Array.isArray(d?.events) ? d.events : []);
      })
      .catch(() => {});
    fetch('/api/gallery/public')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setGallery(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const tenant = data.tenant || null;
  const church = data.church || null;

  const unitName = tenant?.name || fallbackUnit?.name || 'Unit Pelayanan';
  const tagline = tenant?.tagline || fallbackUnit?.desc || '';
  const description = tenant?.description || fallbackUnit?.desc || '';
  const logo = tenant?.logoUrl || theme.logo || brand?.logoGehc || '/visuals/brand/logo-gehc.png';
  const gmimLogo = brand?.logoGmim || '/visuals/brand/logo-gmim.png';
  const heroImage = tenant?.heroImageUrl || landing.heroBanner || '';
  const schedules = tenant?.schedules?.length ? tenant.schedules : church?.schedules || [];
  const socials = tenant?.socials && Object.keys(tenant.socials).length ? tenant.socials : church?.socials || {};
  const socialItems = SOCIAL_ITEMS.filter(({ key }) => Boolean(socials[key]));
  const address = church?.addressText || '';
  const mapUrl = church?.mapShareUrl || DEFAULT_MAP_URL;
  const contactEmail = tenant?.contactEmail || church?.contactEmail || '';
  const registrationOpen = Boolean(tenant?.registrationOpen);

  const agenda = useMemo(
    () =>
      [...events]
        .filter((e) => !['ARCHIVED'].includes(String(e.status || '').toUpperCase()))
        .sort((a, b) => {
          const ta = new Date(a.eventDate || a.startDate || 0).getTime() || Infinity;
          const tb = new Date(b.eventDate || b.startDate || 0).getTime() || Infinity;
          return ta - tb;
        })
        .slice(0, 6),
    [events],
  );

  const photos = useMemo(() => {
    const IMG_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;
    return gallery
      .filter((g) => {
        if (String(g.mediaType || '').toUpperCase() === 'VIDEO') return false;
        if (g.thumbUrl) return true;
        return IMG_RE.test(String(g.mediaUrl || ''));
      })
      .slice(0, 9);
  }, [gallery]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${unitName} — GEHC.page`;
  }, [unitName]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="crest-watermark pointer-events-none select-none absolute top-24 sm:top-32 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 sm:gap-10 opacity-[0.05] z-0"
      >
        <img src={gmimLogo} alt="" className="w-[300px] sm:w-[520px] h-auto object-contain" />
        <img src={logo} alt="" className="w-[300px] sm:w-[520px] h-auto object-contain" />
      </div>

      <header className="sticky top-0 z-40 apple-glass border-b border-[#D9D7D0]/60">
        <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt={unitName} className="h-10 w-10 object-contain rounded-full bg-white/70 p-0.5 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[11px] tracking-tight truncate">{unitName}</span>
              <span className="text-[10px] text-[#8C8880] tracking-tight truncate">
                GMIM Eben Haezer Cikarang
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {registrationOpen && (
              <a
                href="#/register"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Daftar
              </a>
            )}
            <a
              href="#/portal"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-brand to-brand-end text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:opacity-95 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk Portal
            </a>
          </div>
        </div>
      </header>

      <section className={`${CONTAINER} pt-16 sm:pt-24 pb-12 relative z-10`}>
        <div className="absolute inset-0 -z-10 pointer-events-none flex justify-center">
          <div className="w-[680px] h-[400px] bg-gradient-to-tr from-brand/20 via-brand/10 to-brand-end/15 blur-[130px] rounded-full -translate-y-20" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="max-w-3xl relative">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand bg-brand/10 px-3 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              {fallbackUnit?.nameEn || 'Unit Pelayanan'}
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-black leading-[1.05] mt-6">
              {unitName}
            </h1>
            {tagline && (
              <p className="text-base sm:text-lg font-bold text-[#1B1B1B]/80 mt-4">{tagline}</p>
            )}
            <p className="text-sm sm:text-base text-[#8C8880] leading-relaxed mt-4 max-w-2xl">
              {description || 'Selamat datang di laman unit pelayanan GMIM Eben Haezer Cikarang.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <a
                href="#/portal"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B1B1B] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-all"
              >
                <LogIn className="w-4 h-4" />
                Masuk Portal
              </a>
              {registrationOpen && (
                <a
                  href="#/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Daftar Anggota
                </a>
              )}
              {address && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold uppercase tracking-wider hover:bg-white transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  Lokasi Gereja
                </a>
              )}
            </div>
          </div>

          <div className="relative">
            {heroImage ? (
              <div className="relative overflow-hidden rounded-[32px] border border-[#D9D7D0] shadow-xl aspect-[4/3]">
                <img src={heroImage} alt={unitName} className="w-full h-full object-cover" />
                <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${fallbackUnit?.accent || 'from-brand to-brand-end'}`} />
              </div>
            ) : (
              <div className={`rounded-[32px] bg-gradient-to-br ${fallbackUnit?.accent || 'from-brand to-brand-end'} aspect-[4/3] flex items-center justify-center`}>
                <img src={logo} alt={unitName} className="w-32 h-32 object-contain drop-shadow-lg" />
              </div>
            )}
          </div>
        </div>
      </section>

      {schedules.length > 0 && (
        <section className={`${CONTAINER} pb-16`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Jadwal</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">Ibadah &amp; Persekutuan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {schedules.map((s, i) => (
              <div key={i} className="rounded-[24px] bg-white border border-[#E9E8E4] p-5">
                <Clock className="w-4 h-4 text-brand" />
                <p className="font-bold text-sm mt-3">{s.label || s.day || 'Ibadah'}</p>
                <p className="text-xs text-[#8C8880] mt-1">
                  {[s.day, s.time].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {agenda.length > 0 && (
        <section className={`${CONTAINER} pb-16`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Agenda</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">Kegiatan Mendatang</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {agenda.map((e) => (
              <a
                key={e.id}
                href={e.slug ? `#/event/${e.slug}` : '#/portal'}
                className="group rounded-[24px] bg-white border border-[#E9E8E4] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <CalendarDays className="w-4 h-4 text-brand" />
                <p className="font-bold text-sm mt-3 leading-snug">{e.name || 'Kegiatan'}</p>
                <p className="text-xs text-[#8C8880] mt-1">{fmtDate(e.eventDate || e.startDate) || 'Jadwal menyusul'}</p>
                {(e.venueName || e.locationDetail) && (
                  <p className="text-[11px] text-[#BDBAB2] mt-2 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {e.venueName || e.locationDetail}
                  </p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className={`${CONTAINER} pb-16`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Galeri</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">Momen Pelayanan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            {photos.map((g) => (
              <div key={g.id} className="overflow-hidden rounded-2xl border border-[#E9E8E4] bg-white aspect-square">
                <img
                  src={g.thumbUrl || g.mediaUrl}
                  alt={g.title || 'Galeri'}
                  loading="lazy"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {pengurus.length > 0 && (
        <section className={`${CONTAINER} pb-16`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Pengurus</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">Struktur Pelayanan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {pengurus.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 flex items-center gap-3 ${
                  m.isOpenRole ? 'border-dashed border-[#D9D7D0] bg-transparent' : 'border-[#E9E8E4] bg-white'
                }`}
              >
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name} className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-brand" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${m.isOpenRole ? 'text-[#BDBAB2]' : 'text-[#1B1B1B]'}`}>
                    {m.name}
                  </p>
                  <p className="text-[11px] text-[#8C8880] truncate">
                    {m.position || m.subdivision || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`${CONTAINER} pb-20`}>
        <div className="rounded-[28px] bg-[#151515] text-white p-8 sm:p-12 grid grid-cols-1 md:grid-cols-2 gap-10 relative overflow-hidden">
          <div className="relative">
            <h2 className="font-display text-2xl sm:text-3xl font-black">{unitName}</h2>
            {address && <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-3">{address}</p>}
            <div className="flex flex-col gap-4 mt-8">
              {schedules.slice(0, 4).map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{s.label || s.day || 'Ibadah'}</p>
                    <p className="text-xs text-white/60">{[s.day, s.time].filter(Boolean).join(', ')}</p>
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
                <MapPin className="w-4 h-4 text-brand" />
                Buka di Peta
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition-all"
                >
                  <Mail className="w-4 h-4 text-brand" />
                  {contactEmail}
                </a>
              )}
            </div>
            {socialItems.length > 0 && (
              <div className="flex items-center gap-2 mt-6">
                {socialItems.map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={socials[key]}
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
              href="#/portal"
              className="rounded-[24px] bg-gradient-to-r from-brand to-brand-end p-6 hover:opacity-95 transition-all"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Portal Unit</p>
              <p className="font-display text-xl font-black mt-1">Masuk ke Portal {fallbackUnit?.name || unitName}</p>
              <p className="text-xs text-white/80 mt-2">
                Agenda, warta, kas unit, dan pelayanan unit dalam satu tempat.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold mt-4">
                Buka Portal <ArrowUpRight className="w-4 h-4" />
              </span>
            </a>
            <div className="rounded-[24px] bg-white/5 p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Jemaat</p>
              <a href="https://gehc.page" className="inline-flex items-center gap-1 text-xs font-bold mt-2">
                Kunjungi laman jemaat <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#151515] text-white/50 py-8 px-4">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <img src={gmimLogo} alt="GMIM" className="w-10 h-10 object-contain opacity-80" />
            <span className="h-8 w-px bg-white/15" aria-hidden="true" />
            <img src={logo} alt={unitName} className="w-9 h-9 object-contain rounded-full bg-white/90 p-0.5 opacity-90" />
          </div>
          <p className="text-[11px]">
            © {new Date().getFullYear()} GMIM Eben Haezer Cikarang (GEHC) — {unitName}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default UnitLanding;
