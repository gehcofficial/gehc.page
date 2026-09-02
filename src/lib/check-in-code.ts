export const CHECKIN_PREFIX = 'GEHC-BT';

export function buildCheckInCode(waitingPoolId: string, registeredAt: Date | string | number): string {
  const ms = registeredAt instanceof Date ? registeredAt.getTime() : new Date(registeredAt).getTime();
  return `${CHECKIN_PREFIX}|${waitingPoolId}|${ms}`;
}

export function parseCheckInCode(raw: string): { prefix: string; waitingPoolId: string; registeredAtMs: number } | null {
  const code = String(raw || '').trim();
  const parts = code.split('|');
  if (parts.length !== 3) return null;
  const [prefix, waitingPoolId, msRaw] = parts;
  if (prefix !== CHECKIN_PREFIX || !waitingPoolId) return null;
  const registeredAtMs = Number(msRaw);
  if (!Number.isFinite(registeredAtMs) || registeredAtMs <= 0) return null;
  return { prefix, waitingPoolId, registeredAtMs };
}

export function timestampsMatch(stored: Date | string, scannedMs: number, slackMs = 1000): boolean {
  const storedMs = stored instanceof Date ? stored.getTime() : new Date(stored).getTime();
  return Math.abs(storedMs - scannedMs) <= slackMs;
}
