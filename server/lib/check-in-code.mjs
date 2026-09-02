export const CHECKIN_PREFIX = 'GEHC-BT';

export function buildCheckInCode(waitingPoolId, registeredAt) {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_PREFIX}|${waitingPoolId}|${ms}`;
}

export function parseCheckInCode(raw) {
  const code = String(raw || '').trim();
  const parts = code.split('|');
  if (parts.length !== 3) return null;
  const [prefix, waitingPoolId, msRaw] = parts;
  if (prefix !== CHECKIN_PREFIX || !waitingPoolId) return null;
  const registeredAtMs = Number(msRaw);
  if (!Number.isFinite(registeredAtMs) || registeredAtMs <= 0) return null;
  return { prefix, waitingPoolId, registeredAtMs };
}

export function timestampsMatch(stored, scannedMs, slackMs = 1000) {
  const storedMs = stored instanceof Date ? stored.getTime() : new Date(stored).getTime();
  return Math.abs(storedMs - scannedMs) <= slackMs;
}
