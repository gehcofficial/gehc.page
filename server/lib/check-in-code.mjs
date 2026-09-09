export const CHECKIN_PREFIX = 'GEHC-BT';
/** QR per (user, event) lewat baris attendee — multi-event tanpa ubah schema. */
export const CHECKIN_ATTENDEE_PREFIX = 'GEHC-EA';

export function buildCheckInCode(waitingPoolId, registeredAt) {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_PREFIX}|${waitingPoolId}|${ms}`;
}

export function buildAttendeeCode(attendeeId, registeredAt) {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_ATTENDEE_PREFIX}|${attendeeId}|${ms}`;
}

export function parseCheckInCode(raw) {
  const code = String(raw || '').trim();
  const parts = code.split('|');
  if (parts.length !== 3) return null;
  const [prefix, refId, msRaw] = parts;
  if ((prefix !== CHECKIN_PREFIX && prefix !== CHECKIN_ATTENDEE_PREFIX) || !refId) return null;
  const registeredAtMs = Number(msRaw);
  if (!Number.isFinite(registeredAtMs) || registeredAtMs <= 0) return null;
  return {
    prefix,
    // Kompatibel-mundur: consumer lama memakai waitingPoolId.
    waitingPoolId: prefix === CHECKIN_PREFIX ? refId : null,
    attendeeId: prefix === CHECKIN_ATTENDEE_PREFIX ? refId : null,
    kind: prefix === CHECKIN_ATTENDEE_PREFIX ? 'attendee' : 'pool',
    registeredAtMs,
  };
}

export function timestampsMatch(stored, scannedMs, slackMs = 1000) {
  const storedMs = stored instanceof Date ? stored.getTime() : new Date(stored).getTime();
  return Math.abs(storedMs - scannedMs) <= slackMs;
}
