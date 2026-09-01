import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { GehcLogo } from '../brand/GehcLogo';
import { BrandCaption } from '../brand/BrandCaption';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { useApp } from '../../context/AppContext';
import { getCachedAccounts, CachedAccount } from '../../lib/cachedAccounts';
import { getNextFromHash, resolvePostAuthHash } from '../../lib/hash-routes';
import { finishAuthRedirect } from '../../lib/auth-redirect';

/**
 * Layar masuk portal — dua metode:
 *   1. Akun Google   : tanpa password (diverifikasi Google)
 *   2. Email & sandi : akun lokal hasil undangan panitia
 * Plus daftar akun yang pernah dipakai di perangkat ini (cached).
 */
export const PortalLogin: React.FC = () => {
  const { setActiveView } = useApp();
  const [cached] = useState<CachedAccount[]>(() => getCachedAccounts());
  const [clientId, setClientId] = useState<string | null>(null);
  const [method, setMethod] = useState<'google' | 'local'>(
    () => (getCachedAccounts().length ? 'google' : 'google')
  );
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId))
      .catch(() => {});
  }, []);

  const afterAuth = async () => {
    const next = getNextFromHash();
    if (next) {
      await finishAuthRedirect(next);
      return;
    }
    setActiveView('portal');
    window.location.hash = '#/portal';
    window.location.reload();
  };

  const onCredential = (credential: string) => {
    fetch('/api/auth/google', {
      method: 'POST',
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Login gagal');
        await afterAuth();
      })
      .catch((x) => setErr(x.message))
      .finally(() => setBusy(false));
  };

  /** Chip cached: staging/demo → langsung masuk satu-klik; produksi → arahkan ke tombol Google. */
  const quickCachedLogin = async (acct: CachedAccount) => {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/demo/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acct.email }),
      });
      if (!res.ok) throw new Error('Gunakan tombol Google untuk masuk.');
      await afterAuth();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <GehcLogo size={64} className="mx-auto mb-4 shadow-2xl" />
          <h1 className="text-2xl font-black tracking-tight">Portal Administrasi</h1>
          <BrandCaption className="mt-3 items-center" align="center" />
        </div>

        {/* Kartu metode */}
        <div className="rounded-[28px] bg-white/[0.04] border border-white/10 p-6 space-y-4">
          {clientId ? (
            <div className="flex justify-center pb-1">
              <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
            </div>
          ) : (
            <p className="text-[11px] text-white/40 text-center leading-relaxed">
              Login Google sementara tidak tersedia — gunakan Email &amp; Kata Sandi.
              <br />
              <span className="text-white/30">Panduan aktivasi: drive-integration.md §8.</span>
            </p>
          )}

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
            <span className="flex-1 h-px bg-white/10" /> atau <span className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={localLogin} className="space-y-3">
            <input
              type="email" required placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] border border-white/15 text-sm font-medium focus:outline-none focus:border-[#FF416C]"
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

          {err && (
            <p className="text-[11px] text-red-400 font-semibold text-center">{err}</p>
          )}

          {/* Cached accounts */}
          {cached.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2.5">
                Akun pernah dipakai di perangkat ini
              </p>
              <div className="space-y-1.5">
                {cached.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => quickCachedLogin(a)}
                    disabled={busy}
                    title={a.source === 'demo' ? 'Masuk cepat' : 'Masuk lewat popup Google'}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 transition-colors text-left disabled:opacity-50"
                  >
                    <img src={a.avatar || ''} alt={a.name} loading="lazy" decoding="async"
                      className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{a.name}</p>
                      <p className="text-[10px] text-white/40 truncate">{a.email}</p>
                    </div>
                    {a.source === 'demo' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
