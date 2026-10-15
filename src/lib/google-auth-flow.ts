import { fetchAuthConfig } from '../services/authApi';
import { finishAuthRedirect } from './auth-redirect';

export async function registerWithGoogleCredential(credential: string, next?: string | null): Promise<void> {
  const res = await fetch('/api/register/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && (data as { existingAccount?: boolean }).existingAccount) {
      const login = await fetch('/api/auth/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const loginData = await login.json().catch(() => ({}));
      if (!login.ok) throw new Error((loginData as { error?: string }).error || 'Login gagal.');
    } else {
      throw new Error((data as { error?: string }).error || 'Pendaftaran Google gagal.');
    }
  }
  await finishAuthRedirect(next);
}

export async function joinWithGoogleCredential(credential: string, code: string): Promise<void> {
  const res = await fetch('/api/join', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Gabung via Google gagal.');
  await finishAuthRedirect('#/portal');
}

const CLIENT_ID_KEY = 'gehc_google_client_id_v1';
const CLIENT_ID_TTL = 5 * 60_000;

let memClientId: string | null | undefined;

function readCachedClientId(): string | null | null {
  if (memClientId !== undefined) return memClientId;
  try {
    const raw = localStorage.getItem(CLIENT_ID_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string | null; at: number };
    if (Date.now() - parsed.at > CLIENT_ID_TTL) return null;
    memClientId = parsed.id;
    return parsed.id;
  } catch {
    return null;
  }
}

function writeCachedClientId(id: string | null) {
  memClientId = id;
  try {
    localStorage.setItem(CLIENT_ID_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch { /* storage diblokir */ }
}

export async function loadGoogleClientId(): Promise<string | null> {
  const cached = readCachedClientId();
  if (cached) return cached;
  try {
    const cfg = await fetchAuthConfig();
    if (cfg.clientId) writeCachedClientId(cfg.clientId);
    return cfg.clientId;
  } catch {
    return cached;
  }
}
