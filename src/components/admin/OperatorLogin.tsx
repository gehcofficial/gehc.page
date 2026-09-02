import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, Loader2 } from 'lucide-react';
import {
  operatorLocalLogin,
  operatorPasskeyLogin,
  operatorPasskeyLoginOptions,
} from '../../services/platformApi';

function base64URLToBuffer(base64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function prepAuthOptions(options: PublicKeyCredentialRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge as unknown as string),
    allowCredentials: (options.allowCredentials || []).map((c) => ({
      ...c,
      id: base64URLToBuffer(c.id as unknown as string),
    })),
  };
}

export const OperatorLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'passkey' | 'local'>('passkey');
  const [webauthnMock, setWebauthnMock] = useState(false);

  useEffect(() => {
    fetch('/api/operator/auth/config')
      .then((r) => r.json())
      .then((d) => setWebauthnMock(Boolean(d.webauthnMock)))
      .catch(() => {});
  }, []);

  const passkeyLogin = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      if (webauthnMock) {
        await operatorPasskeyLogin(email, {}, true);
        onSuccess();
        return;
      }
      const { options } = await operatorPasskeyLoginOptions(email);
      const cred = (await navigator.credentials.get({
        publicKey: prepAuthOptions(options),
      })) as PublicKeyCredential;
      if (!cred) throw new Error('Passkey dibatalkan.');
      const att = cred.response as AuthenticatorAssertionResponse;
      await operatorPasskeyLogin(email, {
        id: cred.id,
        rawId: bufferToBase64URL(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: bufferToBase64URL(att.clientDataJSON),
          authenticatorData: bufferToBase64URL(att.authenticatorData),
          signature: bufferToBase64URL(att.signature),
          userHandle: att.userHandle ? bufferToBase64URL(att.userHandle) : undefined,
        },
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [email, onSuccess, webauthnMock]);

  const localLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await operatorLocalLogin(email, password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1a] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-[#FF416C] font-semibold mb-2">GEHC Platform</p>
        <h1 className="text-2xl font-bold mb-1">Operator Login</h1>
        <p className="text-sm text-white/60 mb-6">Akun bootstrap Tim Tech — terpisah dari portal jemaat.</p>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('passkey')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'passkey' ? 'bg-[#FF416C] text-white' : 'bg-white/5'}`}
          >
            Passkey
          </button>
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'local' ? 'bg-[#FF416C] text-white' : 'bg-white/5'}`}
          >
            Break-glass
          </button>
        </div>

        <label className="block text-xs text-white/50 mb-1">Email operator</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm"
          placeholder="ops-staging@gehc.demo"
        />

        {mode === 'passkey' ? (
          <button
            type="button"
            disabled={busy || !email}
            onClick={() => void passkeyLogin()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#FF416C] font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Login dengan Passkey
          </button>
        ) : (
          <form onSubmit={localLogin}>
            <label className="block text-xs text-white/50 mb-1">Password break-glass</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-white/10 font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Login Lokal
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {webauthnMock && (
          <p className="mt-4 text-xs text-amber-400">WEBAUTHN_MOCK aktif — passkey di-skip untuk E2E.</p>
        )}
      </div>
    </div>
  );
};
