export const BAKUTAU_PENDING_KEY = 'gehc_bakutau_pending';

export type BakutauPendingPayload = {
  name: string;
  phone: string;
  gender: string;
  origin: string;
  domicileKind: string;
  domicileDetail?: string;
};

export function saveBakutauPending(payload: BakutauPendingPayload) {
  sessionStorage.setItem(BAKUTAU_PENDING_KEY, JSON.stringify(payload));
}

export function loadBakutauPending(): BakutauPendingPayload | null {
  try {
    const raw = sessionStorage.getItem(BAKUTAU_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BakutauPendingPayload;
    if (!parsed?.phone?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearBakutauPending() {
  sessionStorage.removeItem(BAKUTAU_PENDING_KEY);
}

export async function applyPendingBakutauRegistration(): Promise<{ applied: boolean; error?: string }> {
  const pending = loadBakutauPending();
  if (!pending) return { applied: false };

  try {
    await fetch('/api/me/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: pending.phone,
        gender: pending.gender,
        origin: pending.origin,
      }),
    });

    const reg = await fetch('/api/events/baku-tau-4-0/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending),
    });
    if (!reg.ok) {
      const d = await reg.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || 'Gagal mendaftar BAKU TAU.');
    }

    const claim = await fetch('/api/events/baku-tau-4-0/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pending.phone }),
    });
    if (!claim.ok) {
      const d = await claim.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || 'Gagal mengklaim pendaftaran.');
    }

    clearBakutauPending();
    window.dispatchEvent(new CustomEvent('gehc:bakutau-applied'));
    return { applied: true };
  } catch (err) {
    return { applied: false, error: (err as Error).message };
  }
}
