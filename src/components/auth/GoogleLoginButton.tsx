import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext';

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}

let gsiScriptLoaded = false;
let gsiInitialized = false;

function loadGsiScript(): Promise<void> {
  if (gsiScriptLoaded && window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        gsiScriptLoaded = true;
        resolve();
        return;
      }
      existing.addEventListener('load', () => {
        gsiScriptLoaded = true;
        resolve();
      });
      existing.addEventListener('error', () => reject(new Error('Gagal memuat Google Identity Services.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Gagal memuat Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/** Tombol "Sign in with Google" resmi via GIS — dirender sekali per clientId+locale. */
const GoogleLoginButton: React.FC<Props> = ({ clientId, onCredential, onError }) => {
  const { lang } = useLang();
  const locale = lang === 'en' ? 'en' : 'id';
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);

  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        if (!gsiInitialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => onCredentialRef.current(response.credential),
          });
          gsiInitialized = true;
        }
        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'medium',
          shape: 'pill',
          text: 'signin_with',
          locale,
        });
        setReady(true);
      })
      .catch((err: Error) => onErrorRef.current?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, locale]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center min-h-[40px]" />
      {!ready && (
        <p className="text-[10px] text-white/40 text-center">Memuat tombol Google…</p>
      )}
    </div>
  );
};

export default GoogleLoginButton;
