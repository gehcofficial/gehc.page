import { describe, expect, it } from 'vitest';
import { buildCheckInCode, parseCheckInCode, timestampsMatch } from '../../src/lib/check-in-code';

describe('check-in QR payload', () => {
  it('round-trips pool id and registration timestamp', () => {
    const at = new Date('2026-08-01T10:00:00+07:00');
    const code = buildCheckInCode('wp-abc', at);
    expect(code).toBe(`GEHC-BT|wp-abc|${at.getTime()}`);
    expect(parseCheckInCode(code)).toEqual({
      prefix: 'GEHC-BT',
      waitingPoolId: 'wp-abc',
      registeredAtMs: at.getTime(),
    });
  });

  it('rejects malformed payloads', () => {
    expect(parseCheckInCode('')).toBeNull();
    expect(parseCheckInCode('GEHC-BT|only-two')).toBeNull();
    expect(parseCheckInCode('OTHER|wp-abc|1')).toBeNull();
    expect(parseCheckInCode('GEHC-BT|wp-abc|nope')).toBeNull();
  });

  it('allows 1s slack on timestamp match', () => {
    const at = new Date('2026-08-01T10:00:00Z');
    expect(timestampsMatch(at, at.getTime())).toBe(true);
    expect(timestampsMatch(at, at.getTime() + 400)).toBe(true);
    expect(timestampsMatch(at, at.getTime() + 2000)).toBe(false);
  });
});
