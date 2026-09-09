import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Field } from '../ui/joinParts';
import { EventVenueMap } from '../ui/EventVenueMap';
import { applyPendingEventRegistration, saveEventPending } from '../../../lib/event-pending';
import { EmailRegisterPanel, GoogleRegisterPanel } from './shared/AuthPanels';
import { BakuTauWelcomeCard } from '../../portal/BakuTauWelcomeCard';
import { EventRegisterCard } from './EventRegisterCard';
import { EventSelfAnswersCard } from '../../portal/EventSelfAnswersCard';
import { titleCaseName } from '../../../lib/person-name';

type Stats = { registered: number; withAccount?: number; checkedIn?: number };

type Info = {
  id: string;
  slug: string;
  name: string;
  status: string;
  venueName?: string;
  locationDetail?: string;
  mapUrl?: string;
  mapEmbedQuery?: string;
  eventDate?: string;
  whatsappGroupUrl?: string | null;
  stats?: Stats | null;
};

type RegState = {
  registered: boolean;
  whatsappGroupUrl?: string | null;
  checkInCode?: string | null;
  registeredAt?: string | null;
};

export const EventSignupPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { authUser } = useApp();
  const [info, setInfo] = useState<Info | null>(null);
  const [infoError, setInfoError] = useState('');
  const [reg, setReg] = useState<RegState>({ registered: false });
  const [stats, setStats] = useState<Stats | null>(null);
  const [booting, setBooting] = useState(true);

  const eventNext = `event/${slug}`;
  const loginHref = `#/login?next=${encodeURIComponent(eventNext)}`;
  const registerHref = `#/register?next=${encodeURIComponent(eventNext)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setInfo(d);
        setStats(d.stats || null);
      })
      .catch((e: Error) => {
        if (!cancelled) setInfoError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (booting || !info || info.status === 'ARCHIVED') return;
    if (!authUser) {
      setReg({ registered: false });
      return;
    }
    let cancelled = false;
    (async () => {
      await applyPendingEventRegistration(slug).catch(() => null);
      const r = await fetch(`/api/events/${encodeURIComponent(slug)}/my-registration`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (cancelled) return;
      setReg({
        registered: Boolean(d.registered),
        whatsappGroupUrl: d.whatsappGroupUrl || info.whatsappGroupUrl || null,
        checkInCode: d.checkInCode || null,
        registeredAt: d.registeredAt || null,
      });
      const s = await fetch(`/api/events/${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
      if (!cancelled && s?.stats) setStats(s.stats);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, slug, booting, info?.id]);

  if (booting) {
    return (
      <section className="pt-[130px] pb-24 px-4 max-w-xl mx-auto text-center text-sm text-[#8C8880]">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Memuat event…
      </section>
    );
  }

  if (infoError || !info) {
    return (
      <section className="pt-[130px] pb-24 px-4 max-w-xl mx-auto text-center">
        <h1 className="text-xl font-black mb-2">Event tidak ditemukan</h1>
        <p className="text-sm text-[#8C8880] mb-4">Slug: {slug || '(kosong)'}</p>
        <a href="#/events" className="text-sm font-bold text-[#FF416C]">← Kembali ke kegiatan</a>
      </section>
    );
  }

  if (info.status === 'ARCHIVED') {
    return (
      <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-black mb-2">{info.name} — Arsip</h1>
        <p className="text-sm text-[#8C8880] mb-6">Acara ini sudah selesai. Lihat dokumentasi di warta.</p>
        <a href="#/bulletin" className="text-sm font-bold text-[#FF416C]">Buka warta →</a>
      </section>
    );
  }

  const eventDateLabel = info.eventDate
    ? new Date(info.eventDate).toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
    : null;

  return (
    <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-2">{info.name}</p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2 font-display">
        Daftar Kehadiran
      </h1>
      <p className="text-sm text-[#8C8880] mb-8 leading-relaxed">
        {authUser
          ? (reg.registered
            ? 'Kehadiranmu sudah tercatat. Simpan QR di bawah untuk daftar ulang hari H.'
            : 'Satu langkah lagi: konfirmasi kehadiran di akun ini.')
          : 'Masuk dengan Google, atau isi nama & WhatsApp di counter panitia.'}
      </p>

      {stats && (
        <div className="rounded-2xl bg-[#181818] text-white p-4 flex items-center gap-3 mb-4">
          <Users className="w-4 h-4 text-[#FF416C]" />
          <span className="text-xs font-bold">{stats.registered} peserta terdaftar</span>
        </div>
      )}

      {authUser && reg.registered && (
        <>
          <BakuTauWelcomeCard
            eventName={info.name}
            whatsappGroupUrl={reg.whatsappGroupUrl}
            eventDate={info.eventDate}
            venueName={info.venueName}
            locationDetail={info.locationDetail}
            mapUrl={info.mapUrl}
            mapEmbedQuery={info.mapEmbedQuery}
            checkInCode={reg.checkInCode}
            registeredAt={reg.registeredAt}
            showPortalLink
          />
          <div className="mt-4">
            <EventSelfAnswersCard eventId={info.id} />
          </div>
        </>
      )}

      {authUser && !reg.registered && (
        <EventRegisterCard
          slug={slug}
          eventName={info.name}
          onRegistered={(payload) => {
            if (payload) {
              setReg({
                registered: true,
                whatsappGroupUrl: payload.whatsappGroupUrl || info.whatsappGroupUrl || null,
                checkInCode: payload.checkInCode || null,
                registeredAt: payload.registeredAt || null,
              });
            }
            fetch(`/api/events/${encodeURIComponent(slug)}/my-registration`, { credentials: 'include' })
              .then((r) => r.json())
              .then((d) => setReg({
                registered: Boolean(d.registered),
                whatsappGroupUrl: d.whatsappGroupUrl || info.whatsappGroupUrl || null,
                checkInCode: d.checkInCode || null,
                registeredAt: d.registeredAt || null,
              }))
              .catch(() => {});
          }}
        />
      )}

      {!authUser && <GuestEventFlow slug={slug} eventName={info.name} registerHref={registerHref} loginHref={loginHref} eventNext={eventNext} />}

      {info.venueName && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 mt-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-3">Lokasi acara</p>
          {eventDateLabel && (
            <p className="text-xs font-bold text-[#1B1B1B] mb-3 capitalize">{eventDateLabel} WIB</p>
          )}
          <EventVenueMap
            venueName={info.venueName}
            locationDetail={info.locationDetail}
            mapUrl={info.mapUrl}
            embedQuery={info.mapEmbedQuery}
            compact
          />
        </div>
      )}
    </section>
  );
};

const GuestEventFlow: React.FC<{ slug: string; eventName: string; registerHref: string; loginHref: string; eventNext: string }> = ({
  slug,
  eventName,
  registerHref,
  loginHref,
  eventNext,
}) => {
  const [pathMode, setPathMode] = useState<'akun' | 'counter'>('akun');
  const [step, setStep] = useState<'form' | 'account'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '' });

  const submitQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mendaftar.');
      if (d.whatsappGroupUrl) setWhatsappGroupUrl(d.whatsappGroupUrl);
      saveEventPending(slug, { name: form.name.trim(), phone: form.phone.trim() });
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
            <p className="text-xs text-[#8C8880] mt-1">Masuk dengan Google di tab yang sama supaya QR & grup WA menempel ke akunmu.</p>
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
            <p className="text-[11px] text-center text-[#8C8880]">Link grup tampil setelah akun tersinkron (jika panitia sudah mengisi tautan).</p>
          )}
          <GoogleRegisterPanel hint="Pakai Google yang sama. Jangan ganti tab/browser." next={eventNext} loginHref={loginHref} />
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#8C8880]">
            <span className="flex-1 h-px bg-[#D9D7D0]" /> atau <span className="flex-1 h-px bg-[#D9D7D0]" />
          </div>
          <EmailRegisterPanel hint="Buat akun email & kata sandi." next={eventNext} loginHref={loginHref} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-[#F3F1EC] p-1 gap-1">
        {([
          { id: 'akun' as const, label: 'Punya akun / Google' },
          { id: 'counter' as const, label: 'Counter panitia' },
        ]).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setPathMode(m.id)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
              pathMode === m.id ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {pathMode === 'akun' && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
          <GoogleRegisterPanel
            title="Masuk lalu konfirmasi kehadiran"
            hint="Setelah Google, konfirmasi daftar di atas."
            next={eventNext}
            loginHref={loginHref}
          />
          <EmailRegisterPanel hint="Atau daftar dengan email." next={eventNext} loginHref={loginHref} />
          <a href={registerHref} onClick={(e) => { e.preventDefault(); window.location.hash = registerHref.replace(/^#/, ''); }}
            className="block text-center text-[10px] text-[#8C8880] hover:text-[#1B1B1B] font-semibold">
            Belum punya akun? Daftar membership
          </a>
        </div>
      )}

      {pathMode === 'counter' && (
        <form onSubmit={submitQuick} className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Counter panitia — nama & WhatsApp</p>
          <Field
            label="Nama lengkap *"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: titleCaseName(v) })}
            onBlur={() => setForm((f) => ({ ...f, name: titleCaseName(f.name).trim() }))}
            required
          />
          <Field label="No. WhatsApp *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan & tautkan Google
          </button>
        </form>
      )}
    </div>
  );
};
