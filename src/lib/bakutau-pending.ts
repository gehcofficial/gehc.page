import {
  saveEventPending,
  loadEventPending,
  clearEventPending,
  applyPendingEventRegistration,
  BAKUTAU_PENDING_KEY,
} from './event-pending';

export { BAKUTAU_PENDING_KEY };
export type { EventPendingPayload as BakutauPendingPayload } from './event-pending';

const SLUG = 'bakutau';

export function saveBakutauPending(payload: Parameters<typeof saveEventPending>[1]) {
  return saveEventPending(SLUG, payload);
}

export function loadBakutauPending() {
  return loadEventPending(SLUG);
}

export function clearBakutauPending() {
  return clearEventPending(SLUG);
}

export function applyPendingBakutauRegistration() {
  return applyPendingEventRegistration(SLUG);
}
