import { fetchAuthConfig } from '../services/authApi';
import { applyPendingBakutauRegistration } from './bakutau-pending';

export async function registerWithGoogleCredential(credential: string): Promise<void> {
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
  await applyPendingBakutauRegistration();
  window.location.hash = '#/portal';
  window.location.reload();
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
  window.location.hash = '#/portal';
  window.location.reload();
}

export async function loadGoogleClientId(): Promise<string | null> {
  try {
    const cfg = await fetchAuthConfig();
    return cfg.clientId;
  } catch {
    return null;
  }
}
