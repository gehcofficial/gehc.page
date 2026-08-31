import { applyPendingEventRegistration, loadEventPending } from './event-pending';
import { getNextFromHash, resolvePostAuthHash } from './hash-routes';

const EVENT_SLUGS = ['bakutau'] as const;

export async function finishAuthRedirect(explicitNext?: string | null) {
  for (const slug of EVENT_SLUGS) {
    if (loadEventPending(slug)) {
      await applyPendingEventRegistration(slug);
      break;
    }
  }
  const next = explicitNext ?? getNextFromHash();
  window.location.hash = resolvePostAuthHash(next).replace(/^#/, '');
  window.location.reload();
}
