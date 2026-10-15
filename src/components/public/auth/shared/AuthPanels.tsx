import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import GoogleLoginButton from '../../../auth/GoogleLoginButton';
import { LoadingOverlay } from '../../ui/LoadingOverlay';
import { Field } from '../../ui/joinParts';
import { loadGoogleClientId } from '../../../../lib/google-auth-flow';
import { referralCodeFromHash } from '../../../../lib/marturia';
import type { EmailRegisterPayload } from '../../../../lib/email-auth-flow';
import { finishAuthRedirect } from '../../../../lib/auth-redirect';
import { PersonNameFields } from '../../../portal/PersonNameFields';
import {
  composeOfficialName,
  emptyPersonName,
  validatePersonName,
  type PersonNameParts,
} from '../../../../lib/person-name';

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
  theme = 'light',
}) => {
  const tone = panelTone(theme === 'dark' ? 'dark' : 'light');
  const [clientId, setClientId] = useState<string | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastCredential = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleClientId().then((id) => { if (!cancelled) setClientId(id); })
      .finally(() => { if (!cancelled) setCfgLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runCredential = async (credential: string) => {
    lastCredential.current = credential;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/register/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, ref: referralCodeFromHash() || undefined }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && (data as { existingAccount?: boolean }).existingAccount) {
          const login = await fetch('/api/auth/google', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
            signal: ctrl.signal,
          });
          const loginData = await login.json().catch(() => ({}));
          if (!login.ok) throw new Error((loginData as { error?: string }).error || 'Login gagal.');
        } else {
          throw new Error((data as { error?: string }).error || 'Pendaftaran Google gagal.');
        }
      }
      await finishAuthRedirect(next);
    } catch (e) {
      if (ctrl.signal.aborted) return; // timeout — overlay menampilkan retry
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const onCredential = async (credential: string) => { await runCredential(credential); };

  const cancelBusy = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  const retryBusy = () => {
    if (lastCredential.current) void runCredential(lastCredential.current);
  };

  return (
    <div className="relative space-y-3">
      {title && <p className={`text-[10px] font-black uppercase tracking-widest ${tone.label}`}>{title}</p>}
      {hint && <p className={`text-xs leading-relaxed ${tone.hint}`}>{hint}</p>}
      {err && <p className={`text-xs font-semibold ${tone.err}`}>{err}</p>}
      {busy && (
        <LoadingOverlay
          variant="section"
          kind="google"
          dark={theme === 'dark'}
          timeoutMs={25000}
          onTimeout={cancelBusy}
          onRetry={retryBusy}
          onBack={cancelBusy}
        />
      )}
      {clientId && !busy && (
        <div className="flex justify-center">
          <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
        </div>
      )}
      {cfgLoading && !clientId && !busy && (
        <div className="flex justify-center py-1" aria-busy="true">
          <span className="w-40 h-10 rounded-full bg-black/5 animate-pulse" />
        </div>
      )}
      {!cfgLoading && !clientId && (
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
  theme = 'light',
}) => {
  const tone = panelTone(theme === 'dark' ? 'dark' : 'light');
  const [form, setForm] = useState({ email: '', password: '', phone: '' });
  const [nameParts, setNameParts] = useState<PersonNameParts>(emptyPersonName());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const nameErr = validatePersonName(nameParts);
      if (nameErr) throw new Error(nameErr);
      const payload: EmailRegisterPayload = {
        name: composeOfficialName(nameParts),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      };
      const res = await fetch('/api/register/local', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ref: referralCodeFromHash() || undefined,
          givenName: nameParts.givenName,
          middleName: nameParts.middleName,
          familyName: nameParts.familyName,
          churchTitle: nameParts.churchTitle || null,
          academicTitles: nameParts.academicTitles,
        }),
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
        <PersonNameFields value={nameParts} onChange={setNameParts} theme={theme} />
        <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required theme={theme} />
        <Field label="Kata sandi * (min. 8 karakter)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required theme={theme} />
        <Field label="No. WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="08xxxxxxxxxx" theme={theme} />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-full bg-gradient-to-r from-brand to-brand-end text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
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

