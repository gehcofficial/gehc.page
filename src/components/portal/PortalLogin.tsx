import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { useApp } from '../../context/AppContext';
import { getNextFromHash } from '../../lib/hash-routes';
import { finishAuthRedirect } from '../../lib/auth-redirect';

export const PortalLogin: React.FC = () => {
  const { setActiveView } = useApp();
  const [clientId, setClientId] = useState<string | null>(null);
  const [form, setForm] = useState({ login: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId))
      .catch(() => {});
  }, []);

  const afterAuth = async () => {
    const next = getNextFromHash();
    await finishAuthRedirect(next);
  };

  const onCredential = (credential: string) => {
    fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Login gagal');
        await afterAuth();
      })
      .catch((e) => setErr(e.message));
  };

  const localLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    fetch('/api/auth/local', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: form.login, password: form.password }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Login gagal');
        await afterAuth();
      })
      .catch((x) => setErr(x.message))
      .finally(() => setBusy(false));
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

        <div className="rounded-[28px] bg-white/[0.04] border border-white/10 p-6 space-y-4">
          {clientId ? (
            <div className="flex justify-center pb-1">
              <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
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
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] border border-white/15 text-sm font-medium focus:outline-none focus:border-[#FF416C]"
              autoComplete="username"
            />
            <input
              type="password" required placeholder="Kata sandi"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] border border-white/15 text-sm font-medium focus:outline-none focus:border-[#FF416C]"
            />
            <button
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider shadow-lg disabled:opacity-50"
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
