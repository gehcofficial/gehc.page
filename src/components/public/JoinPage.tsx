import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { GIFT_BANK, TALENT_OPTIONS, scoreAnswers } from '../../data/giftBank';
import { Field, Center, DoneCard } from './ui/joinParts';

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

/** Halaman Join — Google register & invite link (unified onboarding pipeline). */
export const JoinPage: React.FC = () => {
  const hashQuery = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(hashQuery);
  const tokenFromUrl = params.get('token');
  const invFromUrl = params.get('inv');

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
          : 'Gabung GEHC Youth'}
      </h1>
      <p className="text-sm text-[#8C8880] mb-8 leading-relaxed">
        Daftar dengan Google atau link undangan untuk masuk pipeline onboarding lengkap.
        Profil, tes karunia, dan penempatan role akan ditangani admin.
      </p>

      {tokenFromUrl ? (
        <StageB token={tokenFromUrl} />
      ) : invFromUrl ? (
        <InviteJoin code={invFromUrl} />
      ) : (
        <GoogleRegister />
      )}
    </section>
  );
};

// ---------------- Daftar mandiri via Google (PENDING → approval Komisi) ----------------
const GoogleRegister: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [registered, setRegistered] = useState<{ status: string; division?: string; subdivision?: string } | null>(null);
  const [busy, setBusy] = useState(false);

if (registered) {
    const pillarColor = {
      LITURGIA: '#7C3AED',
      DIDASKALIA: '#0EA5E9',
      KOINONIA: '#059669',
      DIAKONIA: '#EA580C',
      MARTURIA: '#DC2626',
    }[registered.division] || '#181818';

    return (
      <div className="space-y-5">
        <div className="rounded-[28px] p-5 text-white bg-[${pillarColor}]/20"
          style={{ backgroundImage: `linear-gradient(135deg, ${pillarColor}20 0, transparent 50%)` }}>
          <h3 className="text-lg font-black">
            {registered.status === 'PENDING' ? 'Terdaftar! Menunggu persetujuan Komisi' : 'Akun aktif!'}
          </h3>
          <p className="text-xs text-white/80 mt-1 leading-relaxed">
            Satu langkah terakhir — lengkapi profil & tes karunia rohanimu.
          </p>
        </div>

        <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
          <Field label="No. WhatsApp" value="" onChange={() => {}} placeholder="08xxxxxxxxxx" />
          <Field label="Asal (kampus / kantor)" value="" onChange={() => {}} placeholder="President University / PT …" />
          <Field label="Jenis Kelamin *" type="select" value="" onChange={() => {}} options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value="" onChange={() => {}} placeholder="Nama orang tua / wali / saudara" required />
            <Field label="Hubungan *" type="select" value="" onChange={() => {}} options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value="" onChange={() => {}} placeholder="08xxxxxxxxxx" required />
            <Field label="Alamat Kontak Darurat *" value="" onChange={() => {}} placeholder="Alamat lengkap" textarea required />
          </div>
          <GiftTestWizard onFinish={async (result) => {
            setBusy(true);
            try {
              await fetch('/api/gifttest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'user', giftsTop5: result.top5, giftsScores: result.scores }),
              });
            } finally {
              setBusy(false);
            }
          }} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
      <Field label="No. WhatsApp" value="" onChange={() => {}} placeholder="08xxxxxxxxxx" />
      <Field label="Asal (kampus / kantor)" value="" onChange={() => {}} placeholder="President University / PT …" />
      {/* Redirect server-side: layar pilih akun Google muncul native */}
      <a
        href={`/api/auth/google/start?mode=register&next=${encodeURIComponent('#/join')}`}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-white text-[#1B1B1B] border border-[#D9D7D0] text-xs font-black hover:border-black transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-4z"/></svg>
        Daftar dengan Google
      </a>
      <p className="text-[10px] text-[#8C8880] text-center">
        Tanpa password — identitas diverifikasi langsung oleh Google.
      </p>
      <p className="text-[10px] text-[#8C8880] text-center mt-2">
        Setelah login, kamu akan diminta memilih Fungsi (Panta Tugas) & Sub-Divisi.
      </p>
    </form>
  );
};

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
        <a
          href={`/api/auth/google/start?mode=join&code=${encodeURIComponent(code)}&next=${encodeURIComponent(`#/join?inv=${code}`)}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-white text-[#1B1B1B] border border-[#D9D7D0] text-xs font-black hover:border-black transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-4z"/></svg>
          Daftar dengan Google
        </a>
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
