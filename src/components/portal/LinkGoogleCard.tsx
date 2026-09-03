import React, { useEffect, useState } from 'react';
import { CheckCircle2, Link2, Loader2 } from 'lucide-react';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import { useApp } from '../../context/AppContext';

export const LinkGoogleCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { ssoClientId } = useApp();
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [googleSub, setGoogleSub] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setLinkStatus(d.user?.linkStatus ?? null);
        setAuthProvider(d.user?.authProvider ?? null);
        setUserId(d.user?.id ?? null);
        setGoogleSub(d.user?.googleSub ?? null);
      })
      .catch(() => {});
  }, [ok]);

  const linked = ok
    || linkStatus === 'LINKED'
    || Boolean(googleSub);
  if (linked) {
    if (compact) return null;
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <p className="text-xs font-semibold text-emerald-700">Akun Google sudah tertaut.</p>
      </div>
    );
  }
  if (linkStatus === null) return null;

  const onCredential = async (credential: string) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/me/link-google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menautkan Google.');
      setOk(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[#D9D7D0]/60 bg-white ${compact ? 'p-4' : 'p-6'} space-y-3`}>
      <div className="flex items-start gap-3">
        <Link2 className="w-5 h-5 text-[#FF416C] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Tautkan akun Google</p>
          <p className="text-[10px] text-[#8C8880] mt-1 leading-relaxed">
            Masuk lebih cepat dan aman — tanpa perlu minta taut dari admin.
          </p>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 font-semibold">{err}</p>}
      {busy && (
        <p className="text-xs text-[#8C8880] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menautkan…
        </p>
      )}
      {!busy && ssoClientId && (
        <div className="flex justify-center">
          <GoogleLoginButton clientId={ssoClientId} onCredential={onCredential} onError={setErr} />
        </div>
      )}
      {!ssoClientId && <p className="text-[10px] text-[#8C8880]">Google SSO belum dikonfigurasi.</p>}
    </div>
  );
};
