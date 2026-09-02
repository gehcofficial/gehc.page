import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Field } from '../ui/joinParts';
import { EventVenueMap } from '../ui/EventVenueMap';
import { DOMICILE_OPTIONS, domicileDetailConfig, type DomicileKind } from '../../../lib/domicile';
import {
  ORIGIN_REGION_OPTIONS,
  SULUT_PLACES,
  TITLE_CASE_HINT,
  buildOriginString,
  titleCaseWords,
  validateOriginForm,
  type OriginRegion,
} from '../../../lib/origin';
import { saveEventPending } from '../../../lib/event-pending';
import { EmailRegisterPanel, GoogleRegisterPanel } from './shared/AuthPanels';
import { BakutauRegisterCard } from '../../portal/BakutauRegisterCard';
import { BakuTauWelcomeCard } from '../../portal/BakuTauWelcomeCard';

type Stats = {
  registered: number;
  withAccount: number;
  profileComplete: number;
  byDomicile?: Record<string, number>;
};

const SLUG = 'bakutau';
const EVENT_NEXT = `event/${SLUG}`;

export const BakutauEventPage: React.FC = () => {
  const { authUser } = useApp();
  const [registered, setRegistered] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState<string | null>(null);
  const [venue, setVenue] = useState<{
    venueName?: string;
    locationDetail?: string;
    mapUrl?: string;
    mapEmbedQuery?: string;
    eventDate?: string;
    status?: string;
  } | null>(null);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    fetch('/api/events/bakutau')
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats || null);
        setVenue({
          venueName: d.venueName,
          locationDetail: d.locationDetail,
          mapUrl: d.mapUrl,
          mapEmbedQuery: d.mapEmbedQuery,
          eventDate: d.eventDate,
          status: d.status,
        });
        if (d.status === 'ARCHIVED') setArchived(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authUser) return;
    fetch('/api/me/baku-tau-registration', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setRegistered(Boolean(d.registered));
        if (d.registered) setWhatsappGroupUrl(d.whatsappGroupUrl || null);
      })
      .catch(() => {});
  }, [authUser?.id]);

  const eventDateLabel = venue?.eventDate
    ? new Date(venue.eventDate).toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
    : null;

  if (archived) {
    return (
      <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-black mb-2">BAKU TAU 4.0 — Arsip</h1>
        <p className="text-sm text-[#8C8880] mb-6">Acara ini sudah selesai. Lihat dokumentasi di warta.</p>
        <a href="#/bulletin" className="text-sm font-bold text-[#FF416C]">Buka warta →</a>
      </section>
    );
  }

  return (
    <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-2">
        BAKU TAU 4.0 — Bakudapa di Rantau
      </p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2 font-display">
        Daftar Kehadiran
      </h1>
      <p className="text-sm text-[#8C8880] mb-8 leading-relaxed">
        {authUser
          ? 'Konfirmasi kehadiranmu — data profil sudah terhubung ke akun.'
          : 'Belum punya akun? Daftar dulu atau isi form counter panitia lalu buat akun.'}
      </p>

      {stats && (
        <div className="rounded-2xl bg-[#181818] text-white p-4 flex items-center gap-3 mb-4">
          <Users className="w-4 h-4 text-[#FF416C]" />
          <span className="text-xs font-bold">{stats.registered} peserta terdaftar</span>
        </div>
      )}

      {authUser ? (
        registered ? (
          <BakuTauWelcomeCard
            whatsappGroupUrl={whatsappGroupUrl}
            eventDate={venue?.eventDate}
            venueName={venue?.venueName}
            locationDetail={venue?.locationDetail}
            mapUrl={venue?.mapUrl}
            mapEmbedQuery={venue?.mapEmbedQuery}
            onCompleteProfile={() => { window.location.hash = '#/portal'; }}
          />
        ) : (
          <BakutauRegisterCard onRegistered={() => {
            setRegistered(true);
            fetch('/api/me/baku-tau-registration', { credentials: 'include' })
              .then((r) => r.json())
              .then((d) => { if (d.registered) setWhatsappGroupUrl(d.whatsappGroupUrl || null); })
              .catch(() => {});
          }} />
        )
      ) : (
        <GuestBakutauFlow />
      )}

      {!(authUser && registered) && venue?.venueName && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 mt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] mb-3">Lokasi acara</p>
          {eventDateLabel && (
            <p className="text-xs font-bold text-[#1B1B1B] mb-3 capitalize">{eventDateLabel} WIB</p>
          )}
          <EventVenueMap
            venueName={venue.venueName}
            locationDetail={venue.locationDetail}
            mapUrl={venue.mapUrl}
            embedQuery={venue.mapEmbedQuery}
            compact
          />
        </div>
      )}
    </section>
  );
};

const GuestBakutauFlow: React.FC = () => {
  const [pathMode, setPathMode] = useState<'google' | 'email' | 'quick'>('google');
  const [step, setStep] = useState<'form' | 'account'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: '',
    originRegion: '' as OriginRegion | '',
    originSulutPlace: '',
    originSulutOther: '',
    originNonSulut: '',
    domicileKind: '',
    domicileDetail: '',
  });

  const domicileDetailCfg = domicileDetailConfig(form.domicileKind as DomicileKind | '');
  const registerNext = EVENT_NEXT;
  const loginHref = `#/login?next=${encodeURIComponent(EVENT_NEXT)}`;
  const registerHref = `#/register?next=${encodeURIComponent(EVENT_NEXT)}`;

  const submitQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const originErr = validateOriginForm(form);
    if (originErr) { setError(originErr); setBusy(false); return; }
    const origin = buildOriginString(form);
    if (!origin) { setError('Lengkapi asal daerah.'); setBusy(false); return; }
    if (domicileDetailCfg?.required && !form.domicileDetail.trim()) {
      setError('Lengkapi perincian domisili.');
      setBusy(false);
      return;
    }
    const domicileDetail = form.domicileDetail.trim() ? titleCaseWords(form.domicileDetail) : '';
    try {
      const res = await fetch('/api/events/baku-tau-4-0/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          gender: form.gender,
          origin,
          domicileKind: form.domicileKind,
          domicileDetail: domicileDetail || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mendaftar.');
      if (d.whatsappGroupUrl) setWhatsappGroupUrl(d.whatsappGroupUrl);
      saveEventPending(SLUG, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        origin,
        domicileKind: form.domicileKind,
        domicileDetail: domicileDetail || undefined,
      });
      setStep('account');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'account') {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-lg font-black">Data counter tersimpan!</h3>
            <p className="text-xs text-[#8C8880] mt-1">Buat akun untuk sinkron ke portal. Grup WhatsApp hanya untuk peserta.</p>
          </div>
          {whatsappGroupUrl ? (
            <a
              href={whatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Gabung Grup WhatsApp
            </a>
          ) : (
            <p className="text-[11px] text-center text-[#8C8880]">Link grup akan dibagikan panitia setelah akun tersinkron.</p>
          )}
          <GoogleRegisterPanel hint="Data pendaftaran tersinkron otomatis." next={registerNext} loginHref={loginHref} />
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#8C8880]">
            <span className="flex-1 h-px bg-[#D9D7D0]" /> atau <span className="flex-1 h-px bg-[#D9D7D0]" />
          </div>
          <EmailRegisterPanel hint="Buat akun email & kata sandi." next={registerNext} loginHref={loginHref} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-[#F3F1EC] p-1 gap-1">
        {(['google', 'email', 'quick'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPathMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
              pathMode === m ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'
            }`}
          >
            {m === 'google' ? 'Google' : m === 'email' ? 'Email' : 'Counter'}
          </button>
        ))}
      </div>

      {pathMode === 'google' && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
          <GoogleRegisterPanel
            title="Buat akun & daftar event"
            hint="Setelah masuk, lengkapi data BAKU TAU di portal."
            next={registerNext}
            loginHref={loginHref}
          />
          <a href={registerHref} onClick={(e) => { e.preventDefault(); window.location.hash = registerHref.replace(/^#/, ''); }}
            className="block text-center text-[10px] text-[#8C8880] hover:text-[#1B1B1B] font-semibold">
            Belum punya akun? Daftar membership
          </a>
        </div>
      )}

      {pathMode === 'email' && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6">
          <EmailRegisterPanel
            title="Daftar dengan email"
            hint="Buat akun lalu lengkapi profil BAKU TAU di portal."
            next={registerNext}
            loginHref={loginHref}
          />
        </div>
      )}

      {pathMode === 'quick' && (
        <>
          <form onSubmit={submitQuick} className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880]">Counter panitia</p>
            <Field label="Nama lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="No. WhatsApp *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
            <Field label="Jenis Kelamin *" type="select" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })}
              options={[{ value: '', label: 'Pilih...' }, { value: 'LAKI-LAKI', label: 'Laki-laki' }, { value: 'PEREMPUAN', label: 'Perempuan' }]} required />
            <Field label="Asal daerah *" type="select" value={form.originRegion}
              onChange={(v) => setForm({ ...form, originRegion: v as OriginRegion | '', originSulutPlace: '', originSulutOther: '', originNonSulut: '' })}
              options={[{ value: '', label: 'Pilih Sulut atau Luar Sulut...' }, ...ORIGIN_REGION_OPTIONS]} required />
            {form.originRegion === 'SULUT' && (
              <>
                <Field label="Kota / kabupaten di Sulut *" type="select" value={form.originSulutPlace}
                  onChange={(v) => setForm({ ...form, originSulutPlace: v, originSulutOther: '' })}
                  options={[{ value: '', label: 'Pilih...' }, ...SULUT_PLACES]} required />
                {form.originSulutPlace === 'LAINNYA_SULUT' && (
                  <Field label="Tulis kota/kabupaten *" value={form.originSulutOther} onChange={(v) => setForm({ ...form, originSulutOther: v })}
                    hint={TITLE_CASE_HINT} onBlur={() => setForm((f) => ({ ...f, originSulutOther: titleCaseWords(f.originSulutOther) }))} required />
                )}
              </>
            )}
            {form.originRegion === 'NON_SULUT' && (
              <Field label="Kota / kabupaten asal *" value={form.originNonSulut} onChange={(v) => setForm({ ...form, originNonSulut: v })}
                hint={TITLE_CASE_HINT} onBlur={() => setForm((f) => ({ ...f, originNonSulut: titleCaseWords(f.originNonSulut) }))} required />
            )}
            <Field label="Domisili saat ini *" type="select" value={form.domicileKind}
              onChange={(v) => setForm({ ...form, domicileKind: v, domicileDetail: '' })}
              options={[{ value: '', label: 'Pilih...' }, ...DOMICILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]} required />
            {domicileDetailCfg?.show && (
              <Field label={domicileDetailCfg.label} value={form.domicileDetail} onChange={(v) => setForm({ ...form, domicileDetail: v })}
                placeholder={domicileDetailCfg.placeholder} hint={TITLE_CASE_HINT}
                onBlur={() => setForm((f) => ({ ...f, domicileDetail: titleCaseWords(f.domicileDetail) }))} required={domicileDetailCfg.required} />
            )}
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan & buat akun
            </button>
          </form>
        </>
      )}
    </div>
  );
};
