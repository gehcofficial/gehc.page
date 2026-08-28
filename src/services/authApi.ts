/**
 * Client untuk Google SSO (server: server/auth.mjs).
 * Cookie sesi httpOnly — fetch selalu credentials: 'include'.
 */
import { User, UserRole, UserRoleMapping } from '../types';
import { pushCachedAccount } from '../lib/cachedAccounts';

export interface AuthConfig {
  clientId: string | null;
  configured: boolean;
}

interface ApiUser {
  accountStatus?: string;
  onboardingStatus?: string;
  giftsTop5?: string[];
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: { userId?: string; tenantId: string; role: string; groupId?: string | null }[];
}

function mapUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar || '',
    accountStatus: u.accountStatus,
    onboardingStatus: u.onboardingStatus,
    giftsTop5: u.giftsTop5,
    roles: (u.roles || []).map(
      (r): UserRoleMapping => ({
        tenantId: r.tenantId,
        role: r.role as UserRole,
        groupId: r.groupId ?? undefined,
      })
    ),
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch('/api/auth/config');
  return handle<AuthConfig>(res);
}

export async function fetchMe(): Promise<User> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await handle<{ user: ApiUser }>(res);
  return mapUser(data.user);
}

export async function loginWithGoogle(credential: string): Promise<User> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  const data = await handle<{ user: ApiUser }>(res);
  
  pushCachedAccount({ id: data.user.id, name: data.user.name, email: data.user.email, avatar: data.user.avatar, source: 'google' });
return mapUser(data.user);
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

// ---- Demo personas (staging only, gated server-side) ----

export async function fetchPersonas(): Promise<User[]> {
  const res = await fetch('/api/demo/personas', { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { users: ApiUser[] };
  return data.users.map(mapUser);
}

export async function impersonate(email: string): Promise<User> {
  const res = await fetch('/api/demo/impersonate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { user: ApiUser };

  pushCachedAccount({ id: data.user.id, name: data.user.name, email: data.user.email, avatar: data.user.avatar, source: 'demo' });
  return mapUser(data.user);
}
