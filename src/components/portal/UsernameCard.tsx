import React, { useEffect, useState } from 'react';
import { AtSign, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const UsernameCard: React.FC = () => {
  const { authUser, addToast } = useApp();
  const [loginUsername, setLoginUsername] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [canChange, setCanChange] = useState(true);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me/username', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.loginUsername || null);
        setLoginUsername(d.loginUsername || '');
        setCanChange(Boolean(d.canChange));
        setBlockReason(d.changeBlockedReason || null);
      })
      .catch(() => {});
  }, [authUser?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/me/username', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginUsername: loginUsername.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan username');
      setCurrent(d.loginUsername);
      addToast({ type: 'success', title: 'Username disimpan', description: `Login dengan: ${d.loginUsername}` });
      window.location.reload();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#FF416C]/10 text-[#FF416C] flex items-center justify-center">
          <AtSign className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#1B1B1B]">Username login</h2>
          <p className="text-[11px] text-[#8C8880]">
            Masuk dengan username + password (cadangan selain Google). Huruf kecil, 4–30 karakter.
          </p>
        </div>
      </div>
      {current && (
        <p className="text-xs text-[#8C8880]">
          Username aktif: <strong className="font-mono text-[#1B1B1B]">{current}</strong>
        </p>
      )}
      {!canChange && blockReason && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{blockReason}</p>
      )}
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <input
          type="text"
          value={loginUsername}
          onChange={(e) => setLoginUsername(e.target.value.toLowerCase())}
          placeholder="contoh: budi.wanget"
          className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm font-mono"
          pattern="[a-z][a-z0-9._]{3,29}"
          disabled={!canChange && Boolean(current)}
        />
        <button
          type="submit"
          disabled={busy || !loginUsername.trim() || (!canChange && Boolean(current))}
          className="px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {current ? 'Ganti username' : 'Set username'}
        </button>
      </form>
    </div>
  );
};
