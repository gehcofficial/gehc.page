import { describe, expect, it } from 'vitest';
import { buildAttendeeCode, buildCheckInCode, parseCheckInCode, timestampsMatch } from '../../src/lib/check-in-code';
import {
  buildAttendeeCode as buildAttendeeCodeSrv,
  buildCheckInCode as buildCheckInCodeSrv,
  parseCheckInCode as parseCheckInCodeSrv,
} from '../../server/lib/check-in-code.mjs';

describe('check-in QR payload', () => {
  it('round-trips pool id and registration timestamp (kompatibel-mundur)', () => {
    const at = new Date('2026-08-01T10:00:00+07:00');
    const code = buildCheckInCode('wp-abc', at);
    expect(code).toBe(`GEHC-BT|wp-abc|${at.getTime()}`);
    expect(parseCheckInCode(code)).toEqual({
      prefix: 'GEHC-BT',
      waitingPoolId: 'wp-abc',
      attendeeId: null,
      kind: 'pool',
      registeredAtMs: at.getTime(),
    });
  });

  it('round-trips attendee id untuk QR multi-event', () => {
    const at = new Date('2026-09-13T07:00:00+07:00');
    const code = buildAttendeeCode('ea-xyz', at);
    expect(code).toBe(`GEHC-EA|ea-xyz|${at.getTime()}`);
    expect(parseCheckInCode(code)).toEqual({
      prefix: 'GEHC-EA',
      waitingPoolId: null,
      attendeeId: 'ea-xyz',
      kind: 'attendee',
      registeredAtMs: at.getTime(),
    });
  });

  it('kopi server identik dengan kopi klien', () => {
    const at = new Date('2026-09-13T07:00:00+07:00');
    expect(buildCheckInCodeSrv('wp-abc', at)).toBe(buildCheckInCode('wp-abc', at));
    expect(buildAttendeeCodeSrv('ea-xyz', at)).toBe(buildAttendeeCode('ea-xyz', at));
    expect(parseCheckInCodeSrv(buildAttendeeCodeSrv('ea-xyz', at))).toEqual(parseCheckInCode(buildAttendeeCode('ea-xyz', at)));
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
