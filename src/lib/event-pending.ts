export const BAKUTAU_PENDING_KEY = 'gehc_bakutau_pending';
export const EVENT_PENDING_PREFIX = 'gehc_event_pending_';

export type EventPendingPayload = {
  eventSlug: string;
  name: string;
  phone: string;
  gender: string;
  origin: string;
  domicileKind?: string;
  domicileDetail?: string;
};

export type BakutauPendingPayload = Omit<EventPendingPayload, 'eventSlug'>;

export function eventPendingKey(slug: string) {
  return `${EVENT_PENDING_PREFIX}${slug}`;
}

export function saveEventPending(slug: string, payload: BakutauPendingPayload) {
  const data: EventPendingPayload = { ...payload, eventSlug: slug };
  sessionStorage.setItem(eventPendingKey(slug), JSON.stringify(data));
  if (slug === 'bakutau') {
    sessionStorage.setItem(BAKUTAU_PENDING_KEY, JSON.stringify(payload));
  }
}

export function loadEventPending(slug: string): EventPendingPayload | null {
  try {
    const raw = sessionStorage.getItem(eventPendingKey(slug));
    if (!raw && slug === 'bakutau') {
      const legacy = sessionStorage.getItem(BAKUTAU_PENDING_KEY);
      if (!legacy) return null;
      const parsed = JSON.parse(legacy) as BakutauPendingPayload;
      if (!parsed?.phone?.trim()) return null;
      return { ...parsed, eventSlug: slug };
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EventPendingPayload;
    if (!parsed?.phone?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearEventPending(slug: string) {
  sessionStorage.removeItem(eventPendingKey(slug));
  if (slug === 'bakutau') {
    sessionStorage.removeItem(BAKUTAU_PENDING_KEY);
  }
}

async function applyBakutauPending(payload: EventPendingPayload) {
  await fetch('/api/me/profile', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: payload.phone,
      gender: payload.gender,
      origin: payload.origin,
    }),
  });

  const reg = await fetch('/api/events/baku-tau-4-0/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!reg.ok) {
    const d = await reg.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error || 'Gagal mendaftar BAKU TAU.');
  }

  const claim = await fetch('/api/events/baku-tau-4-0/claim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: payload.phone }),
  });
  if (!claim.ok) {
    const d = await claim.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error || 'Gagal mengklaim pendaftaran.');
  }
}

export async function applyPendingEventRegistration(slug: string): Promise<{ applied: boolean; error?: string }> {
  const pending = loadEventPending(slug);
  if (!pending) return { applied: false };

  try {
    if (slug === 'bakutau') {
      await applyBakutauPending(pending);
    } else {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || 'Gagal mendaftar event.');
      }
    }
    clearEventPending(slug);
    window.dispatchEvent(new CustomEvent('gehc:event-applied', { detail: { slug } }));
    return { applied: true };
  } catch (err) {
    return { applied: false, error: (err as Error).message };
  }
}
