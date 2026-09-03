export interface OperatorSession {
  id: string;
  email: string;
  displayName: string;
}

export interface PlatformContext {
  isPlatformOperator: boolean;
  isPlatformAdmin: boolean;
  platformCapabilities: string[];
  operator: OperatorSession | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPlatformContext(): Promise<PlatformContext> {
  const res = await fetch('/api/platform/context', { credentials: 'include' });
  return handle<PlatformContext>(res);
}

export async function fetchOperatorMe(): Promise<{ operator: OperatorSession; capabilities: string[] }> {
  const res = await fetch('/api/operator/auth/me', { credentials: 'include' });
  return handle(res);
}

export async function operatorLocalLogin(email: string, password: string): Promise<{ operator: OperatorSession }> {
  const res = await fetch('/api/operator/auth/local', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handle(res);
}

export async function operatorLogout(): Promise<void> {
  await fetch('/api/operator/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function operatorPasskeyLoginOptions(email: string): Promise<{ options: PublicKeyCredentialRequestOptions }> {
  const res = await fetch('/api/operator/auth/passkey/login-options', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handle(res);
}

export async function operatorPasskeyLogin(
  email: string,
  credential: unknown,
  mock = false,
): Promise<{ operator: OperatorSession }> {
  const res = await fetch('/api/operator/auth/passkey/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credential, mock }),
  });
  return handle(res);
}

export async function operatorPasskeyRegisterOptions(): Promise<{ options: PublicKeyCredentialCreationOptions }> {
  const res = await fetch('/api/operator/auth/passkey/register-options', {
    method: 'POST',
    credentials: 'include',
  });
  return handle(res);
}

export async function operatorPasskeyRegister(credential: unknown): Promise<void> {
  const res = await fetch('/api/operator/auth/passkey/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  await handle(res);
}

export async function listPlatformAdminGrants(): Promise<{ grants: unknown[] }> {
  const res = await fetch('/api/operator/admins', { credentials: 'include' });
  return handle(res);
}

export async function grantPlatformAdmin(userId: string, note?: string): Promise<unknown> {
  const res = await fetch('/api/operator/admins', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, note }),
  });
  const data = await handle<{ grant: unknown }>(res);
  return data.grant;
}

export async function revokePlatformAdmin(grantId: string): Promise<void> {
  const res = await fetch(`/api/operator/admins/${grantId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handle(res);
}

export async function fetchPlatformAudit(limit = 50): Promise<{ logs: unknown[] }> {
  const res = await fetch(`/api/operator/audit?limit=${limit}`, { credentials: 'include' });
  return handle(res);
}
