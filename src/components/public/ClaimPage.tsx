import React, { useEffect, useMemo, useState } from 'react';
import GoogleLoginButton from '../auth/GoogleLoginButton';

export const ClaimPage: React.FC = () => {
  const token = useMemo(() => {
    const h = window.location.hash;
    const q = h.includes('?') ? h.slice(h.indexOf('?') + 1) : '';
    return new URLSearchParams(q).get('token') || '';
  }, []);
  const [clientId, setClientId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => setClientId(d.clientId))
      .catch(() => {});
  }, []);

  const onCredential = (credential: string) => {
    setErr('');
    fetch('/api/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, token }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Taut gagal');
        setOk(true);
        setTimeout(() => {
          window.location.hash = '#/beyonders';
          window.location.reload();
        }, 1200);
      })
      .catch((e) => setErr(e.message));
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
      <div className="bg-white rounded-[32px] border border-[#D9D7D0] shadow-sm p-8 max-w-md w-full text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C8880] mb-2">GMIM Eben Haezer Cikarang</p>
        <h1 className="text-2xl font-bold mb-2">Tautkan akun Google</h1>
        <p className="text-sm text-[#8C8880] mb-6">
          Profil jemaat sudah ada di database. Masuk dengan Google untuk mengikat akun ke profil itu.
        </p>
        {!token && <p className="text-sm text-red-600 mb-4">Link taut tidak lengkap. Minta taut baru dari admin.</p>}
        {ok && <p className="text-sm text-emerald-700 mb-4">Berhasil tertaut. Mengalihkan…</p>}
        {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
        {token && clientId && !ok && (
          <div className="flex justify-center">
            <GoogleLoginButton clientId={clientId} onCredential={onCredential} onError={setErr} />
          </div>
        )}
        {token && !clientId && <p className="text-xs text-[#8C8880]">Google SSO belum dikonfigurasi.</p>}
      </div>
    </div>
  );
};
