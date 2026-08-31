import { applyPendingBakutauRegistration } from './bakutau-pending';

export type EmailRegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  origin?: string;
  gender?: string;
};

export async function registerWithEmail(payload: EmailRegisterPayload): Promise<void> {
  const res = await fetch('/api/register/local', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Pendaftaran email gagal.');
  }
  await applyPendingBakutauRegistration();
  window.location.hash = '#/portal';
  window.location.reload();
}
