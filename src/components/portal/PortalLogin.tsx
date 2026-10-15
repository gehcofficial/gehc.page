import React, { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { LoadingOverlay } from '../public/ui/LoadingOverlay';
import { useApp } from '../../context/AppContext';
import { getNextFromHash } from '../../lib/hash-routes';
import { finishAuthRedirect } from '../../lib/auth-redirect';

export const PortalLogin: React.FC = () => {
  const { setActiveView, ssoClientId, ssoLoading } = useApp();
  const [form, setForm] = useState({ login: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const lastCredential = useRef<string | null>(null);

  const afterAuth = async () => {
    const next = getNextFromHash();
    await finishAuthRedirect(next);
  };

  const runGoogle = (credential: string) => {
    lastCredential.current = credential;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusyGoogle(true);
    setErr('');
    fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})) as { error?: string }).error || 'Login gagal');
        await afterAuth();
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return; // timeout — overlay menampilkan retry
        setErr(e.message);
        setBusyGoogle(false);
      });
  };

  const onCredential = (credential: string) => runGoogle(credential);

  const retryGoogle = () => {
    if (lastCredential.current) runGoogle(lastCredential.current);
  };

  const localLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || busyGoogle) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setErr('');
    fetch('/api/auth/local', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: form.login, password: form.password }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Login gagal');
        await afterAuth();
      })
      .catch((x) => {
        if (ctrl.signal.aborted) return;
        setErr(x.message);
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  };

  const cancelBusy = () => {
    abortRef.current?.abort();
    setBusy(false);
    setBusyGoogle(false);
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <GehcLogo size={64} className="mx-auto mb-4 shadow-2xl" />
          <h1 className="text-2xl font-black tracking-tight">Masuk Beyonders</h1>
          <BrandCaption className="mt-3 items-center" align="center" />
          <p className="text-xs text-white/50 mt-3 leading-relaxed">
            Masuk dengan Google, atau username/email + kata sandi.
          </p>
        </div>

        <div className="relative rounded-[28px] bg-white/[0.04] border border-white/10 p-6 space-y-4">
          {ssoLoading ? (
            <div className="flex items-center justify-center gap-2 py-2" aria-busy="true" aria-live="polite">
              <span className="w-32 h-10 rounded-full bg-white/10 animate-pulse" />
            </div>
          ) : ssoClientId ? (
            <div className="flex justify-center pb-1">
              <GoogleLoginButton clientId={ssoClientId} onCredential={onCredential} onError={setErr} />
            </div>
          ) : (
            <p className="text-[11px] text-white/40 text-center leading-relaxed">
              Login Google sementara tidak tersedia — gunakan username &amp; kata sandi.
            </p>
          )}

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
            <span className="flex-1 h-px bg-white/10" /> atau <span className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={localLogin} className="space-y-3">
            <input
              type="text" required placeholder="Username atau email"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] border border-white/15 text-sm font-medium focus:outline-none focus:border-brand"
              autoComplete="username"
            />
            <input
              type="password" required placeholder="Kata sandi"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] border border-white/15 text-sm font-medium focus:outline-none focus:border-brand"
            />
            <button
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand to-brand-end text-white text-xs font-black uppercase tracking-wider shadow-lg disabled:opacity-50"
            >
              Masuk
            </button>
          </form>

          <button
            type="button"
            onClick={() => { window.location.hash = '#/forgot-password'; }}
            className="w-full text-center text-[11px] font-bold text-white/50 hover:text-white/80"
          >
            Lupa kata sandi?
          </button>

          {err && (
            <p className="text-[11px] text-red-400 font-semibold text-center">{err}</p>
          )}
          {(busyGoogle || busy) && (
            <LoadingOverlay
              variant="section"
              kind={busyGoogle ? 'google' : 'generic'}
              dark
              timeoutMs={25000}
              onTimeout={cancelBusy}
              onRetry={busyGoogle ? retryGoogle : undefined}
              onBack={cancelBusy}
            />
          )}
        </div>

        <div className="mt-8 text-center space-y-3">
          <a
            href="#/register"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('public');
              window.location.hash = '#/register';
            }}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            Belum punya akun? Daftar Beyonders
          </a>
          <div>
            <button
              onClick={() => {
                setActiveView('public');
                window.location.hash = '#/beyonders';
              }}
              className="text-xs text-white/40 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke situs publik
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

