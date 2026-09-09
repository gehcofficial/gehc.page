export const CHECKIN_PREFIX = 'GEHC-BT';
/** QR per (user, event) lewat baris attendee — multi-event tanpa ubah schema. */
export const CHECKIN_ATTENDEE_PREFIX = 'GEHC-EA';

export function buildCheckInCode(waitingPoolId: string, registeredAt: Date | string | number): string {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_PREFIX}|${waitingPoolId}|${ms}`;
}

export function buildAttendeeCode(attendeeId: string, registeredAt: Date | string | number): string {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_ATTENDEE_PREFIX}|${attendeeId}|${ms}`;
}

export type ParsedCheckInCode = {
  prefix: string;
  /** Kompatibel-mundur: consumer lama memakai waitingPoolId. */
  waitingPoolId: string | null;
  attendeeId: string | null;
  kind: 'pool' | 'attendee';
  registeredAtMs: number;
};

export function parseCheckInCode(raw: string): ParsedCheckInCode | null {
  const code = String(raw || '').trim();
  const parts = code.split('|');
  if (parts.length !== 3) return null;
  const [prefix, refId, msRaw] = parts;
  if ((prefix !== CHECKIN_PREFIX && prefix !== CHECKIN_ATTENDEE_PREFIX) || !refId) return null;
  const registeredAtMs = Number(msRaw);
  if (!Number.isFinite(registeredAtMs) || registeredAtMs <= 0) return null;
  return {
    prefix,
    waitingPoolId: prefix === CHECKIN_PREFIX ? refId : null,
    attendeeId: prefix === CHECKIN_ATTENDEE_PREFIX ? refId : null,
    kind: prefix === CHECKIN_ATTENDEE_PREFIX ? 'attendee' : 'pool',
    registeredAtMs,
  };
}

export function timestampsMatch(stored: Date | string, scannedMs: number, slackMs = 1000): boolean {
  const storedMs = stored instanceof Date ? stored.getTime() : new Date(stored).getTime();
  return Math.abs(storedMs - scannedMs) <= slackMs;
}
