import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageCircle, Users } from 'lucide-react';
import { GIFT_BANK, TALENT_OPTIONS, scoreAnswers } from '../../data/giftBank';
import { Field, Center, DoneCard } from './ui/joinParts';
import { DOMICILE_OPTIONS, domicileDetailConfig, type DomicileKind } from '../../lib/domicile';
import {
  ORIGIN_REGION_OPTIONS,
  SULUT_PLACES,
  TITLE_CASE_HINT,
  buildOriginString,
  titleCaseWords,
  validateOriginForm,
  type OriginRegion,
} from '../../lib/origin';
import { saveBakutauPending } from '../../lib/bakutau-pending';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { loadGoogleClientId, registerWithGoogleCredential } from '../../lib/google-auth-flow';
import { EventVenueMap } from './ui/EventVenueMap';

/**
 * Wizard Tes Karunia Rohani — 22 karunia × 3 pernyataan (Likert 1–5).
 * Hasil: Top-5 karunia otomatis. Mobile-first untuk pendaftar BAKU TAU.
 */
export const GiftTestWizard: React.FC<{
  onFinish: (result: { top5: { key: string; label: string; score: number }[]; scores: Record<string, number> }) => void;
}> = ({ onFinish }) => {
  const totalItems = GIFT_BANK.length * 3;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);

  const items = useMemo(
    () =>
      GIFT_BANK.flatMap((g, gi) =>
        g.items.map((text, ii) => ({
          key: `${g.key}-${ii}`,
          text,
          giftLabel: g.label,
        }))
      ),
    []
  );

  const answeredCount = Object.keys(answers).length;
  const current = items[step];
  const done = answeredCount === totalItems;

  const setAnswer = (v: number) => {
    setAnswers((prev) => ({ ...prev, [current.key]: v }));
    if (step < items.length - 1)
      setTimeout(() => setStep((s) => Math.min(s + 1, items.length - 1)), 120);
  };

  if (done) {
    const result = scoreAnswers(answers);
    return (
      <div className="bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Tes selesai
        </p>
        <h4 className="text-lg font-black">Top-5 Karunia Rohanimu</h4>
        <div className="mt-3 space-y-2">
          {result.top5.map((g, i) => (
            <div key={g.key} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#181818] text-white text-[10px] font-black flex items-center justify-center">{i + 1}</span>
              <span className="text-sm font-bold">{g.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden ml-2">
                <div className="h-full bg-[#FF416C]" style={{ width: `${(g.score / 15) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold tabular-nums">{g.score}/15</span>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onFinish({
              top5: result.top5,
              scores: Object.fromEntries(result.scores.map((s) => [s.key, s.score])),
            })
          }
          className="mt-5 w-full py-3 rounded-full bg-[#181818] text-white text-xs font-black uppercase tracking-wider"
        >
          Simpan & Lanjut
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">{current.giftLabel}</p>
        <p className="text-[10px] font-bold tabular-nums text-[#8C8880]">
          {step + 1}/{totalItems}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full bg-[#FF416C] transition-all" style={{ width: `${(answeredCount / totalItems) * 100}%` }} />
      </div>
      <p className="text-base font-semibold leading-relaxed min-h-[72px]">{current.text}</p>
      <div className="grid grid-cols-5 gap-1.5 mt-5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setAnswer(v)}
            className={`py-3 rounded-xl border text-sm font-black transition-all ${
              answers[current.key] === v
                ? 'bg-[#181818] text-white border-black'
                : 'bg-white border-[#D9D7D0] hover:border-black'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-3 text-[10px] text-[#8C8880] font-semibold">
        <span>Sangat tidak setuju</span>
        <span>Sangat setuju</span>
      </div>
      <div className="flex justify-between mt-4">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="p-2 rounded-full border border-[#D9D7D0] disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setStep((s) => Math.min(items.length - 1, s + 1))} disabled={step >= items.length - 1 || !answers[current.key]}
          className="p-2 rounded-full border border-[#D9D7D0] disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/** Halaman Join — BAKU TAU quick register, Google register & invite link. */
export const JoinPage: React.FC = () => {
  const hashQuery = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(hashQuery);
  const tokenFromUrl = params.get('token');
  const invFromUrl = params.get('inv');
  const eventFromUrl = params.get('event');
  const isBakutau = eventFromUrl === 'bakutau' || (!tokenFromUrl && !invFromUrl);

  return (
    <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-2">
        BAKU TAU 4.0 — Bakudapa di Rantau
      </p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-2 font-display">
        {tokenFromUrl
          ? 'Lengkapi Profil'
          : invFromUrl
          ? 'Gabung Tim Pelayanan'
          : 'Daftar BAKU TAU 4.0'}
      </h1>
      <p className="text-sm text-[#8C8880] mb-8 leading-relaxed">
        {isBakutau && !invFromUrl && !tokenFromUrl
          ? 'Pilih langsung masuk dengan Google, atau daftar cepat di counter panitia lalu otomatis lanjut ke Google.'
          : 'Daftar dengan Google atau link undangan untuk masuk pipeline onboarding lengkap.'}
      </p>

      {tokenFromUrl ? (
        <StageB token={tokenFromUrl} />
      ) : invFromUrl ? (
        <InviteJoin code={invFromUrl} />
      ) : isBakutau ? (
        <BakutauJoinFlow />
      ) : (
        <GoogleRegister />
      )}
    </section>
  );
};

type Stats = {
  registered: number;
  withAccount: number;
  profileComplete: number;
  byDomicile?: Record<string, number>;
};

const GoogleRegisterPanel: React.FC<{ title?: string; hint?: string }> = ({ title, hint }) => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadGoogleClientId().then(setClientId);
  }, []);

  const onCredential = async (credential: string) => {
    setBusy(true);
    setErr('');
    try {
      await registerWithGoogleCredential(credential);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {title && <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880]">{title}</p>}
      {hint && <p className="text-xs text-[#8C8880] leading-relaxed">{hint}</p>}
      {err && <p className="text-xs text-red-600 font-semibold">{err}</p>}
      {busy && (
        <p className="text-xs text-[#8C8880] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Membuat akun…
        </p>
      )}
      {clientId && !busy && (
        <div className="flex justify-center">
          <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
        </div>
      )}
      {!clientId && (
        <p className="text-[10px] text-[#8C8880] text-center">
          Google SSO belum dikonfigurasi — hubungi panitia atau gunakan counter panitia.
        </p>
      )}
    </div>
  );
};

const BakutauJoinFlow: React.FC = () => {
  const [pathMode, setPathMode] = useState<'google' | 'quick'>('google');
  const [step, setStep] = useState<'form' | 'google'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
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

  const submitQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const originErr = validateOriginForm(form);
    if (originErr) {
      setError(originErr);
      setBusy(false);
      return;
    }
    const origin = buildOriginString(form);
    if (!origin) {
      setError('Lengkapi asal daerah.');
      setBusy(false);
      return;
    }
    if (domicileDetailCfg?.required && !form.domicileDetail.trim()) {
      setError('Lengkapi perincian domisili.');
      setBusy(false);
      return;
    }

    const domicileDetail = form.domicileDetail.trim()
      ? titleCaseWords(form.domicileDetail)
      : '';

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
      setStats(d.stats || stats);

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        origin,
        domicileKind: form.domicileKind,
        domicileDetail: domicileDetail || undefined,
      };
      saveBakutauPending(payload);
      setStep('google');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const [venue, setVenue] = useState<{
    venueName?: string;
    locationDetail?: string;
    mapUrl?: string;
    mapEmbedQuery?: string;
    eventDate?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/events/baku-tau-4-0')
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats || null);
        setWhatsappGroupUrl(d.whatsappGroupUrl || null);
        setVenue({
          venueName: d.venueName,
          locationDetail: d.locationDetail,
          mapUrl: d.mapUrl,
          mapEmbedQuery: d.mapEmbedQuery,
          eventDate: d.eventDate,
        });
      })
      .catch(() => {});
  }, []);

  if (step === 'google') {
    return (
      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
        <div className="text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-lg font-black">Data counter tersimpan!</h3>
          <p className="text-xs text-[#8C8880] mt-1">Satu langkah lagi — buat akun dengan Google.</p>
        </div>
        <GoogleRegisterPanel hint="Data pendaftaran akan otomatis tersinkron ke portal." />
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-[#F3F1EC] p-1 gap-1">
        <button
          type="button"
          onClick={() => setPathMode('google')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
            pathMode === 'google' ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'
          }`}
        >
          Langsung Google
        </button>
        <button
          type="button"
          onClick={() => setPathMode('quick')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
            pathMode === 'quick' ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'
          }`}
        >
          Counter panitia
        </button>
      </div>

      {stats && (
        <div className="rounded-2xl bg-[#181818] text-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF416C]" />
            <span className="text-xs font-bold">{stats.registered} peserta terdaftar</span>
          </div>
          {whatsappGroupUrl && (
            <a href={whatsappGroupUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> Grup WA
            </a>
          )}
        </div>
      )}

      {pathMode === 'google' ? (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
          <GoogleRegisterPanel
            title="Masuk langsung ke portal"
            hint="Buat akun dengan Google, lengkapi profil dan pendaftaran BAKU TAU di portal — tanpa isi form dua kali."
          />
          <a
            href="#/portal"
            onClick={(e) => { e.preventDefault(); window.location.hash = '#/portal'; }}
            className="block text-center text-[10px] text-[#8C8880] hover:text-[#1B1B1B] font-semibold"
          >
            Sudah punya akun? Masuk portal
          </a>
        </div>
      ) : (
        <>
      <form onSubmit={submitQuick} className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880]">Daftar cepat — counter panitia</p>
        <Field label="Nama lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="No. WhatsApp *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="08xxxxxxxxxx" required />
        <Field
          label="Jenis Kelamin *"
          type="select"
          value={form.gender}
          onChange={(v) => setForm({ ...form, gender: v })}
          options={[
            { value: '', label: 'Pilih...' },
            { value: 'LAKI-LAKI', label: 'Laki-laki' },
            { value: 'PEREMPUAN', label: 'Perempuan' },
          ]}
          required
        />
        <Field
          label="Asal daerah *"
          type="select"
          value={form.originRegion}
          onChange={(v) => setForm({
            ...form,
            originRegion: v as OriginRegion | '',
            originSulutPlace: '',
            originSulutOther: '',
            originNonSulut: '',
          })}
          options={[{ value: '', label: 'Pilih Sulut atau Luar Sulut...' }, ...ORIGIN_REGION_OPTIONS]}
          required
        />
        {form.originRegion === 'SULUT' && (
          <>
            <Field
              label="Kota / kabupaten di Sulut *"
              type="select"
              value={form.originSulutPlace}
              onChange={(v) => setForm({ ...form, originSulutPlace: v, originSulutOther: '' })}
              options={[{ value: '', label: 'Pilih kota/kabupaten...' }, ...SULUT_PLACES]}
              required
            />
            {form.originSulutPlace === 'LAINNYA_SULUT' && (
              <Field
                label="Tulis kota/kabupaten di Sulut *"
                value={form.originSulutOther}
                onChange={(v) => setForm({ ...form, originSulutOther: v })}
                placeholder="Tondano"
                hint={TITLE_CASE_HINT}
                onBlur={() => setForm((f) => ({ ...f, originSulutOther: titleCaseWords(f.originSulutOther) }))}
                required
              />
            )}
          </>
        )}
        {form.originRegion === 'NON_SULUT' && (
          <Field
            label="Kota / kabupaten asal *"
            value={form.originNonSulut}
            onChange={(v) => setForm({ ...form, originNonSulut: v })}
            placeholder="Jakarta Selatan"
            hint={TITLE_CASE_HINT}
            onBlur={() => setForm((f) => ({ ...f, originNonSulut: titleCaseWords(f.originNonSulut) }))}
            required
          />
        )}
        <Field
          label="Domisili saat ini *"
          type="select"
          value={form.domicileKind}
          onChange={(v) => setForm({ ...form, domicileKind: v, domicileDetail: '' })}
          options={[{ value: '', label: 'Pilih tempat tinggal...' }, ...DOMICILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
          required
        />
        {domicileDetailCfg?.show && (
          <Field
            label={domicileDetailCfg.label}
            value={form.domicileDetail}
            onChange={(v) => setForm({ ...form, domicileDetail: v })}
            placeholder={domicileDetailCfg.placeholder}
            hint={TITLE_CASE_HINT}
            onBlur={() => setForm((f) => ({ ...f, domicileDetail: titleCaseWords(f.domicileDetail) }))}
            required={domicileDetailCfg.required}
          />
        )}
        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Daftar & lanjut Google
        </button>
      </form>
      <p className="text-[10px] text-[#8C8880] text-center leading-relaxed px-2">
        Setelah submit, lanjutkan dengan tombol Google — data counter tersinkron otomatis.
      </p>
        </>
      )}

      {venue?.venueName && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6">
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
    </div>
  );
};

// ---------------- Daftar mandiri via Google ----------------
const GoogleRegister: React.FC<{ onBack?: () => void }> = () => (
  <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
    <GoogleRegisterPanel hint="Tanpa password — identitas diverifikasi langsung oleh Google." />
  </div>
);

// ---------------- Tahap B — legacy waitlist token (bridge only) ----------------
const StageB: React.FC<{ token: string }> = ({ token }) => {
  const [state, setState] = useState<'loading'|'profile'|'gifttest'|'done'|'error'>('loading');
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [origin, setOrigin] = useState('');
  const [talents, setTalents] = useState<string[]>([]);
  const [gender, setGender] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactAddress, setEmergencyContactAddress] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/waitlist/by-token/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Link tidak valid.');
        setEntry(d.entry);
        if (d.entry?.gender) setGender(d.entry.gender);
        if (d.entry?.emergencyContactName) setEmergencyContactName(d.entry.emergencyContactName);
        if (d.entry?.emergencyContactRelation) setEmergencyContactRelation(d.entry.emergencyContactRelation);
        if (d.entry?.emergencyContactPhone) setEmergencyContactPhone(d.entry.emergencyContactPhone);
        if (d.entry?.emergencyContactAddress) setEmergencyContactAddress(d.entry.emergencyContactAddress);
        setState('profile');
      })
      .catch((e) => { setError(e.message); setState('error'); });
  }, [token]);

  const toggleTalent = (t: string) =>
    setTalents((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  if (state === 'loading') return <Center><Loader2 className="w-5 h-5 animate-spin" /></Center>;
  if (state === 'error') return <div className="py-20 text-center text-sm text-red-600 font-semibold">{error}</div>;
  if (state === 'done') return <DoneCard title="Profil lengkap tersimpan!" body="Panitia akan menghubungimu via WhatsApp. Sambil menunggu, cek detail agenda di halaman Kegiatan." />;

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-gradient-to-br from-[#181818] to-[#262626] p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C]">Lengkapi Profil</p>
        <h3 className="text-lg font-black mt-1">{entry?.name}</h3>
        <p className="text-xs text-white/50">WA: {entry?.phone}</p>
      </div>

      {state === 'profile' && (
        <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
          <Field label="Jenis Kelamin *" type="select" value={gender} onChange={setGender} options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <Field label="Alamat sekarang" value={address} onChange={setAddress} placeholder="Kost / domisili…" textarea />
          <Field label="Asal (kampus / kantor)" value={origin} onChange={setOrigin} placeholder="President University / PT …" />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value={emergencyContactName} onChange={setEmergencyContactName} placeholder="Nama orang tua / wali / saudara" required />
            <Field label="Hubungan *" type="select" value={emergencyContactRelation} onChange={setEmergencyContactRelation} options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={emergencyContactPhone} onChange={setEmergencyContactPhone} placeholder="08xxxxxxxxxx" required />
            <Field label="Alamat Kontak Darurat *" value={emergencyContactAddress} onChange={setEmergencyContactAddress} placeholder="Alamat lengkap" textarea required />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2">Pemetaan Bakat — pilih yang punyalah</p>
            <div className="flex flex-wrap gap-1.5">
              {TALENT_OPTIONS.map((t) => (
                <button key={t} onClick={() => toggleTalent(t)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                    talents.includes(t) ? 'bg-[#181818] text-white border-black' : 'bg-white border-[#D9D7D0]'
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <button onClick={async () => {
              setBusy(true);
              try {
                await fetch(`/api/waitlist/by-token/${encodeURIComponent(token)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ address, origin, talents, gender, emergencyContactName, emergencyContactRelation, emergencyContactPhone, emergencyContactAddress }),
                });
                setState('gifttest');
              } finally {
                setBusy(false);
              }
            }} disabled={busy}
            className="w-full py-3 rounded-full bg-[#181818] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan & Lanjut ke Tes Karunia
          </button>
        </div>
      )}

      {state === 'gifttest' && (
        <GiftTestWizard onFinish={async (result) => {
          setBusy(true);
          try {
            await fetch(`/api/waitlist/by-token/${encodeURIComponent(token)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ giftsTop5: result.top5, giftsScores: result.scores, talents }),
            });
            alert('Tes karunia tersimpan! Panitia akan segera menghubungimu.');
          } finally {
            setBusy(false);
          }
        }} />
      )}
    </div>
  );
};

// ---------------- Join via Invite (Google redirect / Email lokal) ----------------
const InviteJoin: React.FC<{ code: string }> = ({ code }) => {
  const [method, setMethod] = useState<'google' | 'local'>('google');
  const [clientId, setClientId] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ status: string; role: string } | null>(null);
  const [profileDone, setProfileDone] = useState(false);
  const [address, setAddress] = useState('');
  const [origin, setOrigin] = useState('');
  const [talents, setTalents] = useState<string[]>([]);
  const [gender, setGender] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactAddress, setEmergencyContactAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', origin: '',
    gender: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', emergencyContactAddress: '',
  });

  const toggleTalent = (t2: string) =>
    setTalents((prev) => (prev.includes(t2) ? prev.filter((x) => x !== t2) : [...prev, t2]));

  useEffect(() => {
    loadGoogleClientId().then(setClientId);
  }, []);

  const onJoinCredential = async (credential: string) => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gabung via Google gagal.');
      setJoined({ status: d.status, role: d.role });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveSelfProfile = async () => {
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, origin, talents, gender, emergencyContactName, emergencyContactRelation, emergencyContactPhone, emergencyContactAddress }),
    });
  };

  if (joined && !profileDone) {
    return (
      <div className="space-y-5">
        <div className={`rounded-[28px] p-5 text-white ${joined.status === 'PENDING' ? 'bg-gradient-to-br from-amber-600 to-orange-700' : 'bg-gradient-to-br from-emerald-600 to-teal-700'}`}>
          <h3 className="text-lg font-black">
            {joined.status === 'PENDING' ? 'Menunggu persetujuan Komisi' : 'Akun aktif!'}
          </h3>
          <p className="text-xs text-white/80 mt-1 leading-relaxed">
            Satu langkah terakhir — lengkapi profil & tes karunia rohanimu.
          </p>
        </div>

        <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
          <Field label="Jenis Kelamin *" type="select" value={gender} onChange={setGender} options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <Field label="Alamat sekarang" value={address} onChange={setAddress} placeholder="Kost / domisili…" textarea />
          <Field label="Asal (kampus / kantor)" value={origin} onChange={setOrigin} placeholder="President University / PT …" />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value={emergencyContactName} onChange={setEmergencyContactName} placeholder="Nama orang tua / wali / saudara" required />
            <Field label="Hubungan *" type="select" value={emergencyContactRelation} onChange={setEmergencyContactRelation} options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={emergencyContactPhone} onChange={setEmergencyContactPhone} placeholder="08xxxxxxxxxx" required />
            <Field label="Alamat Kontak Darurat *" value={emergencyContactAddress} onChange={setEmergencyContactAddress} placeholder="Alamat lengkap" textarea required />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2">Pemetaan Bakat</p>
            <div className="flex flex-wrap gap-1.5">
              {TALENT_OPTIONS.map((t2) => (
                <button key={t2} onClick={() => toggleTalent(t2)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                    talents.includes(t2) ? 'bg-[#181818] text-white border-black' : 'bg-white border-[#D9D7D0]'
                  }`}>{t2}</button>
              ))}
            </div>
          </div>
        </div>

        <GiftTestWizard onFinish={async (result) => {
          setBusy(true);
          try {
            await saveSelfProfile();
            await fetch('/api/gifttest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scope: 'user', giftsTop5: result.top5, giftsScores: result.scores, talents }),
            });
            setProfileDone(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }} />
        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
      <div className="flex rounded-full bg-[#F3F1EC] border border-[#D9D7D0] p-0.5">
        {([['google', 'Akun Google'], ['local', 'Email & Password']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMethod(m)}
            className={`flex-1 h-8 rounded-full text-[11px] font-bold transition-all ${method === m ? 'bg-white shadow-sm' : 'text-[#8C8880]'}`}>
            {label}
          </button>
        ))}
      </div>

      {method === 'google' && (
        <div className="space-y-3">
          {clientId ? (
            <div className="flex justify-center">
              <GoogleLoginButton clientId={clientId} onCredential={onJoinCredential} onError={setError} />
            </div>
          ) : (
            <p className="text-[10px] text-[#8C8880] text-center">Google SSO belum dikonfigurasi.</p>
          )}
          {busy && (
            <p className="text-xs text-[#8C8880] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memproses…
            </p>
          )}
        </div>
      )}

      {method === 'local' && (
        <div className="space-y-3 pt-1">
          <Field label="Nama Lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Password * (min. 8 karakter)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field label="No. WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Asal (kampus / kantor)" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} />
          <Field label="Jenis Kelamin *" type="select" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} placeholder="Nama orang tua / wali / saudara" required />
            <Field label="Hubungan *" type="select" value={form.emergencyContactRelation} onChange={(v) => setForm({ ...form, emergencyContactRelation: v })} options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} placeholder="08xxxxxxxxxx" required />
            <Field label="Alamat Kontak Darurat *" value={form.emergencyContactAddress} onChange={(v) => setForm({ ...form, emergencyContactAddress: v })} placeholder="Alamat lengkap" textarea required />
          </div>
          <button
            onClick={() => {
              setBusy(true); setError('');
              fetch('/api/join/local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, code }),
              })
                .then(async (r) => {
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error || 'Gagal mendaftar.');
                  setJoined(d);
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
            disabled={busy}
            className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
          >
            Daftar dengan Email
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
    </div>
  );
};
