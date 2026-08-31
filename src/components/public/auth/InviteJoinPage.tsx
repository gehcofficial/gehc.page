import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TALENT_OPTIONS } from '../../../data/giftBank';
import { Field, Center, DoneCard } from '../ui/joinParts';
import GoogleLoginButton from '../../auth/GoogleLoginButton';
import { loadGoogleClientId } from '../../../lib/google-auth-flow';
import { GiftTestWizard } from './shared/GiftTestWizard';

export const LegacyWaitlistPage: React.FC<{ token: string }> = ({ token }) => {
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
  if (state === 'done') return <DoneCard title="Profil lengkap tersimpan!" body="Panitia akan menghubungimu via WhatsApp." />;

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
            <Field label="Nama Kontak Darurat *" value={emergencyContactName} onChange={setEmergencyContactName} required />
            <Field label="Hubungan *" type="select" value={emergencyContactRelation} onChange={setEmergencyContactRelation}
              options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={emergencyContactPhone} onChange={setEmergencyContactPhone} required />
            <Field label="Alamat Kontak Darurat *" value={emergencyContactAddress} onChange={setEmergencyContactAddress} textarea required />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2">Pemetaan Bakat</p>
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
            } finally { setBusy(false); }
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
            setState('done');
          } finally { setBusy(false); }
        }} />
      )}
    </div>
  );
};

export const InviteJoinPage: React.FC<{ code: string }> = ({ code }) => {
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

  useEffect(() => { loadGoogleClientId().then(setClientId); }, []);

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

  if (joined && !profileDone) {
    return (
      <div className="space-y-5">
        <div className={`rounded-[28px] p-5 text-white ${joined.status === 'PENDING' ? 'bg-gradient-to-br from-amber-600 to-orange-700' : 'bg-gradient-to-br from-emerald-600 to-teal-700'}`}>
          <h3 className="text-lg font-black">{joined.status === 'PENDING' ? 'Menunggu persetujuan Komisi' : 'Akun aktif!'}</h3>
          <p className="text-xs text-white/80 mt-1">Lengkapi profil & tes karunia rohanimu.</p>
        </div>
        <div className="space-y-4 bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
          <Field label="Jenis Kelamin *" type="select" value={gender} onChange={setGender} options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <Field label="Alamat sekarang" value={address} onChange={setAddress} textarea />
          <Field label="Asal (kampus / kantor)" value={origin} onChange={setOrigin} />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value={emergencyContactName} onChange={setEmergencyContactName} required />
            <Field label="Hubungan *" type="select" value={emergencyContactRelation} onChange={setEmergencyContactRelation}
              options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={emergencyContactPhone} onChange={setEmergencyContactPhone} required />
            <Field label="Alamat Kontak Darurat *" value={emergencyContactAddress} onChange={setEmergencyContactAddress} textarea required />
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
            await fetch('/api/me', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address, origin, talents, gender, emergencyContactName, emergencyContactRelation, emergencyContactPhone, emergencyContactAddress }),
            });
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
          {busy && <p className="text-xs text-[#8C8880] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memproses…</p>}
        </div>
      )}
      {method === 'local' && (
        <div className="space-y-3 pt-1">
          <Field label="Nama Lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Field label="Password * (min. 8 karakter)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Field label="No. WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Asal (kampus / kantor)" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} />
          <Field label="Jenis Kelamin *" type="select" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })}
            options={[{value:'',label:'Pilih...'},{value:'LAKI-LAKI',label:'Laki-laki'},{value:'PEREMPUAN',label:'Perempuan'}]} required />
          <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/60">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880]">Kontak Darurat (Wajib)</p>
            <Field label="Nama Kontak Darurat *" value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} required />
            <Field label="Hubungan *" type="select" value={form.emergencyContactRelation} onChange={(v) => setForm({ ...form, emergencyContactRelation: v })}
              options={[{value:'',label:'Pilih...'},{value:'ORANG_TUA',label:'Orang Tua'},{value:'SAUDARA',label:'Saudara'},{value:'TEMAN',label:'Teman'},{value:'LAINNYA',label:'Lainnya'}]} required />
            <Field label="No. Telepon Kontak Darurat *" value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} required />
            <Field label="Alamat Kontak Darurat *" value={form.emergencyContactAddress} onChange={(v) => setForm({ ...form, emergencyContactAddress: v })} textarea required />
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
