import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MustChangePasswordGate: React.FC = () => {
  const { authUser, addToast } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!authUser?.mustChangePassword || done) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      addToast({ type: 'error', title: 'Password sementara wajib', description: 'Isi password sementara dari undangan.' });
      return;
    }
    if (newPassword.length < 8) {
      addToast({ type: 'error', title: 'Password terlalu pendek', description: 'Minimal 8 karakter.' });
      return;
    }
    if (newPassword !== confirm) {
      addToast({ type: 'error', title: 'Tidak cocok', description: 'Konfirmasi password berbeda.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal ganti password');
      addToast({ type: 'success', title: 'Password diperbarui', description: 'Google bisa ditaut di Akun → Keamanan.' });
      setDone(true);
      window.location.reload();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal ganti password' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D9D7D0] shadow-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF416C]/10 text-[#FF416C] flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1B1B1B]">Ganti password sementara</p>
            <p className="text-[11px] text-[#8C8880]">Wajib isi password sementara dari undangan sebelum lanjut.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">Password sementara</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">Password baru</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">Ulangi password baru</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Simpan password baru
          </button>
        </form>
      </div>
    </div>
  );
};
