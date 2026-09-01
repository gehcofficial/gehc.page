import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import GoogleLoginButton from '../../../auth/GoogleLoginButton';
import { Field } from '../../ui/joinParts';
import { loadGoogleClientId } from '../../../../lib/google-auth-flow';
import type { EmailRegisterPayload } from '../../../../lib/email-auth-flow';
import { finishAuthRedirect } from '../../../../lib/auth-redirect';

type PanelProps = {
  title?: string;
  hint?: string;
  next?: string | null;
  loginHref?: string;
  loginLabel?: string;
  theme?: 'light' | 'dark';
};

const panelTone = (theme: 'light' | 'dark') =>
  theme === 'dark'
    ? {
        label: 'text-white/40',
        hint: 'text-white/50',
        err: 'text-red-400',
        link: 'text-white/50 hover:text-white',
        input: 'bg-[#181818] border-white/15 text-white placeholder:text-white/30',
        fieldLabel: 'text-white/60',
      }
    : {
        label: 'text-[#8C8880]',
        hint: 'text-[#8C8880]',
        err: 'text-red-600',
        link: 'text-[#8C8880] hover:text-[#1B1B1B]',
        input: 'bg-white border-[#D9D7D0] text-[#1B1B1B]',
        fieldLabel: 'text-[#1B1B1B]',
      };

export const GoogleRegisterPanel: React.FC<PanelProps> = ({
  title,
  hint,
  next,
  loginHref,
  loginLabel = 'Sudah punya akun? Masuk',
  theme: PanelProps['theme'] = 'light',
}) => {
  const tone = panelTone(theme ?? 'light');
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
      const res = await fetch('/api/register/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && (data as { existingAccount?: boolean }).existingAccount) {
          const login = await fetch('/api/auth/google', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
          });
          const loginData = await login.json().catch(() => ({}));
          if (!login.ok) throw new Error((loginData as { error?: string }).error || 'Login gagal.');
        } else {
          throw new Error((data as { error?: string }).error || 'Pendaftaran Google gagal.');
        }
      }
      await finishAuthRedirect(next);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {title && <p className={`text-[10px] font-black uppercase tracking-widest ${tone.label}`}>{title}</p>}
      {hint && <p className={`text-xs leading-relaxed ${tone.hint}`}>{hint}</p>}
      {err && <p className={`text-xs font-semibold ${tone.err}`}>{err}</p>}
      {busy && (
        <p className={`text-xs flex items-center justify-center gap-2 ${tone.hint}`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Membuat akun…
        </p>
      )}
      {clientId && !busy && (
        <div className="flex justify-center">
          <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
        </div>
      )}
      {!clientId && (
        <p className={`text-[10px] text-center ${tone.hint}`}>
          Google SSO belum dikonfigurasi — gunakan email & kata sandi.
        </p>
      )}
      {loginHref && (
        <a
          href={loginHref}
          onClick={(e) => { e.preventDefault(); window.location.hash = loginHref.replace(/^#/, ''); }}
          className={`block text-center text-[10px] font-semibold ${tone.link}`}
        >
          {loginLabel}
        </a>
      )}
    </div>
  );
};

export const EmailRegisterPanel: React.FC<PanelProps> = ({
  title,
  hint,
  next,
  loginHref,
  loginLabel = 'Sudah punya akun? Masuk',
  theme: PanelProps['theme'] = 'light',
}) => {
  const tone = panelTone(theme ?? 'light');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const payload: EmailRegisterPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      };
      const res = await fetch('/api/register/local', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Pendaftaran email gagal.');
      await finishAuthRedirect(next);
    } catch (ex) {
      setErr((ex as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {title && <p className={`text-[10px] font-black uppercase tracking-widest ${tone.label}`}>{title}</p>}
      {hint && <p className={`text-xs leading-relaxed ${tone.hint}`}>{hint}</p>}
      {err && <p className={`text-xs font-semibold ${tone.err}`}>{err}</p>}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required theme={theme} />
        <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required theme={theme} />
        <Field label="Kata sandi * (min. 8 karakter)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required theme={theme} />
        <Field label="No. WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="08xxxxxxxxxx" theme={theme} />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Daftar dengan Email
        </button>
      </form>
      {loginHref && (
        <a
          href={loginHref}
          onClick={(e) => { e.preventDefault(); window.location.hash = loginHref.replace(/^#/, ''); }}
          className={`block text-center text-[10px] font-semibold ${tone.link}`}
        >
          {loginLabel}
        </a>
      )}
    </div>
  );
};
