import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}

let gsiScriptLoaded = false;

function loadGsiScript(): Promise<void> {
  if (gsiScriptLoaded && window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
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

/** Tombol "Sign in with Google" resmi via GIS. */
const GoogleLoginButton: React.FC<Props> = ({ clientId, onCredential, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'medium',
          shape: 'pill',
          text: 'signin_with',
          locale: 'id',
        });
        setReady(true);
      })
      .catch((err: Error) => onError?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center min-h-[30px]" />
      {!ready && (
        <p className="text-[10px] text-white/40 text-center">Memuat tombol Google…</p>
      )}
    </div>
  );
};

export default GoogleLoginButton;
