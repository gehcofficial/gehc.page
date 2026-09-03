import React, { useState } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { GehcLogo } from '../../brand/GehcLogo';

export const ForgotPasswordPage: React.FC = () => {
  const [login, setLogin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setResetUrl('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal');
      setMsg(d.message || 'Jika akun terdaftar, taut reset telah dibuat.');
      if (d.resetUrl) setResetUrl(d.resetUrl);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal memproses permintaan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <GehcLogo size={48} className="mx-auto mb-4" />
          <h1 className="text-xl font-black text-[#1B1B1B]">Lupa kata sandi</h1>
          <p className="text-sm text-[#8C8880] mt-2">Masukkan username atau email akun Anda.</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[#8C8880] uppercase">Username atau email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9D7D0] text-sm"
                placeholder="username atau email"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-[#181818] text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Kirim taut reset
          </button>
          {msg && <p className="text-xs text-[#8C8880]">{msg}</p>}
          {resetUrl && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-[10px] font-bold text-amber-900 mb-1">Mode dev — taut reset:</p>
              <a href={resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="text-[10px] text-[#FF416C] break-all">
                {resetUrl}
              </a>
            </div>
          )}
        </form>
        <button
          type="button"
          onClick={() => { window.location.hash = '#/login'; }}
          className="flex items-center gap-2 text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B] mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke login
        </button>
      </div>
    </div>
  );
};
