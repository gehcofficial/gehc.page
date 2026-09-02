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

export interface MeResponse {
  user: ApiUser;
  activeRole?: UserRole | null;
  activeNamespace?: string | null;
  profileIncomplete?: boolean;
  loginUsername?: string | null;
  hasPassword?: boolean;
  googleLinked?: boolean;
  onboardingPath?: string;
  platformAdmin?: boolean;
  platformCapabilities?: string[];
  isPlatformOperator?: boolean;
}

interface ApiUser {
  accountStatus?: string;
  onboardingStatus?: string;
  onboardingPath?: string;
  loginUsername?: string | null;
  giftsTop5?: string[];
  isBeyonders?: boolean;
  mustChangePassword?: boolean;
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: { userId?: string; tenantId: string; role: string; groupId?: string | null }[];
}

function mapUser(u: ApiUser, meta?: { hasPassword?: boolean; googleLinked?: boolean }): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar || '',
    accountStatus: u.accountStatus,
    onboardingStatus: u.onboardingStatus,
    onboardingPath: u.onboardingPath as User['onboardingPath'],
    loginUsername: u.loginUsername,
    hasPassword: meta?.hasPassword,
    googleLinked: meta?.googleLinked,
    giftsTop5: u.giftsTop5,
    isBeyonders: u.isBeyonders,
    mustChangePassword: Boolean(u.mustChangePassword),
    roles: (u.roles || []).map(
      (r): UserRoleMapping => ({
        tenantId: r.tenantId,
        role: r.role as UserRole,
        groupId: r.groupId ?? undefined,
      }),
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

export async function fetchMeFull(): Promise<{
  user: User;
  activeRole: UserRole | null;
  activeNamespace: string | null;
  platformAdmin: boolean;
  platformCapabilities: string[];
  isPlatformOperator: boolean;
}> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await handle<MeResponse>(res);
  return {
    user: mapUser(data.user, { hasPassword: data.hasPassword, googleLinked: data.googleLinked }),
    activeRole: (data.activeRole as UserRole) || null,
    activeNamespace: data.activeNamespace || null,
    platformAdmin: Boolean(data.platformAdmin),
    platformCapabilities: data.platformCapabilities || [],
    isPlatformOperator: Boolean(data.isPlatformOperator),
  };
}

export async function fetchMe(): Promise<User> {
  const { user } = await fetchMeFull();
  return user;
}

export async function setActiveRole(role: UserRole): Promise<{ activeRole: UserRole; activeNamespace: string }> {
  const res = await fetch('/api/auth/active-role', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await handle<{ activeRole: UserRole; activeNamespace: string }>(res);
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ message: string; resetUrl?: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handle(res);
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, newPassword }),
  });
  await handle(res);
}

export async function loginWithGoogle(credential: string): Promise<{ user: User; activeRole: UserRole | null }> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  const data = await handle<{ user: ApiUser; activeRole?: UserRole }>(res);
  pushCachedAccount({
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatar: data.user.avatar,
    source: 'google',
  });
  return {
    user: mapUser(data.user),
    activeRole: data.activeRole || null,
  };
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function loginWithLocal(login: string, password: string): Promise<{ user: User; activeRole: UserRole | null }> {
  const res = await fetch('/api/auth/local', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const data = await handle<{ user: ApiUser; activeRole?: UserRole }>(res);
  return {
    user: mapUser(data.user, { hasPassword: true }),
    activeRole: data.activeRole || null,
  };
}
