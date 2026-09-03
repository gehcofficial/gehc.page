import React, { useMemo, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { GehcLogo } from '../../brand/GehcLogo';

function tokenFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const qIdx = hash.indexOf('?');
  const query = qIdx >= 0 ? hash.slice(qIdx + 1) : '';
  return new URLSearchParams(query).get('token')?.trim() || '';
}

export const ResetPasswordPage: React.FC = () => {
  const token = useMemo(() => tokenFromHash(), []);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErr('Token reset tidak ditemukan di URL.');
      return;
    }
    if (newPassword.length < 8) {
      setErr('Password minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirm) {
      setErr('Konfirmasi password tidak cocok.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal reset password');
      setDone(true);
      const ns = d.activeNamespace || 'mentee';
      setTimeout(() => {
        window.location.hash = `#/portal/${ns}/dashboard`;
        window.location.reload();
      }, 800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <GehcLogo size={48} className="mx-auto mb-4" />
          <h1 className="text-xl font-black text-[#1B1B1B]">Reset kata sandi</h1>
          <p className="text-sm text-[#8C8880] mt-2">Buat password baru untuk akun Anda.</p>
        </div>
        {done ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center text-sm text-green-800">
            Password berhasil diperbarui. Mengalihkan ke portal…
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#8C8880]">
              <KeyRound className="w-4 h-4" />
              <span className="text-[10px] font-mono truncate">{token ? `token: ${token.slice(0, 8)}…` : 'Token tidak ada'}</span>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-[#8C8880] uppercase">Password baru</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D9D7D0] text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-[#8C8880] uppercase">Ulangi password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D9D7D0] text-sm"
              />
            </label>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button
              type="submit"
              disabled={busy || !token}
              className="w-full py-2.5 rounded-xl bg-[#181818] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Simpan password baru
            </button>
          </form>
        )}
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
