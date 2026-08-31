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
};

export const GoogleRegisterPanel: React.FC<PanelProps> = ({
  title,
  hint,
  next,
  loginHref = '#/login',
  loginLabel = 'Sudah punya akun? Masuk',
}) => {
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
          Google SSO belum dikonfigurasi — gunakan email & kata sandi.
        </p>
      )}
      {loginHref && (
        <a
          href={loginHref}
          onClick={(e) => { e.preventDefault(); window.location.hash = loginHref.replace(/^#/, ''); }}
          className="block text-center text-[10px] text-[#8C8880] hover:text-[#1B1B1B] font-semibold"
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
  loginHref = '#/login',
  loginLabel = 'Sudah punya akun? Masuk',
}) => {
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
      {title && <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880]">{title}</p>}
      {hint && <p className="text-xs text-[#8C8880] leading-relaxed">{hint}</p>}
      {err && <p className="text-xs text-red-600 font-semibold">{err}</p>}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama lengkap *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        <Field label="Kata sandi * (min. 8 karakter)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
        <Field label="No. WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="08xxxxxxxxxx" />
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
          className="block text-center text-[10px] text-[#8C8880] hover:text-[#1B1B1B] font-semibold"
        >
          {loginLabel}
        </a>
      )}
    </div>
  );
};
