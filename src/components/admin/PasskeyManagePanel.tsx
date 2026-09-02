import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { operatorPasskeyRegister, operatorPasskeyRegisterOptions } from '../../services/platformApi';

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

function prepRegOptions(options: PublicKeyCredentialCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge as unknown as string),
    user: {
      ...options.user,
      id: base64URLToBuffer(options.user.id as unknown as string),
    },
    excludeCredentials: (options.excludeCredentials || []).map((c) => ({
      ...c,
      id: base64URLToBuffer(c.id as unknown as string),
    })),
  };
}

export const PasskeyManagePanel: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const register = async () => {
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const { options } = await operatorPasskeyRegisterOptions();
      const cred = (await navigator.credentials.create({
        publicKey: prepRegOptions(options),
      })) as PublicKeyCredential;
      if (!cred) throw new Error('Registrasi dibatalkan.');
      const att = cred.response as AuthenticatorAttestationResponse;
      await operatorPasskeyRegister({
        id: cred.id,
        rawId: bufferToBase64URL(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: bufferToBase64URL(att.clientDataJSON),
          attestationObject: bufferToBase64URL(att.attestationObject),
          transports: (att as AuthenticatorAttestationResponse & { getTransports?: () => string[] }).getTransports?.() || [],
        },
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-xl font-bold">Kelola Passkey</h2>
      <p className="text-sm text-[#8C8880]">Daftarkan passkey baru untuk login operator tanpa password.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void register()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF416C] text-white text-sm font-medium"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Tambah Passkey
      </button>
      {done && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" /> Passkey berhasil didaftarkan.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};
