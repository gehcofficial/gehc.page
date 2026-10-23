import { describe, expect, it } from 'vitest';
import {
  computeSlotStatus,
  effectiveScheduleStatus,
  SLOT_STATUS,
  eventEndPlusSixMs,
} from '../../server/lib/penatalayan-slot-status.mjs';

describe('penatalayan slot status', () => {
  it('kosong bila belum ada jadwal atau request', () => {
    expect(computeSlotStatus({})).toBe(SLOT_STATUS.KOSONG);
  });

  it('minta divisi bila request PENDING', () => {
    expect(computeSlotStatus({ pendingRequest: { status: 'PENDING' } })).toBe(SLOT_STATUS.MINTA_DIVISI);
  });

  it('dijadwalkan → dikonfirmasi → selesai', () => {
    const end = new Date('2026-10-25T06:00:00.000Z');
    expect(computeSlotStatus({
      schedule: { status: 'SCHEDULED', userId: 'u1' },
      eventEndAt: end,
    })).toBe(SLOT_STATUS.DIJADWALKAN);
    expect(computeSlotStatus({
      schedule: { status: 'CONFIRMED', userId: 'u1' },
      eventEndAt: end,
    })).toBe(SLOT_STATUS.DIKONFIRMASI);
    expect(computeSlotStatus({
      schedule: { status: 'DONE', userId: 'u1' },
      eventEndAt: end,
    })).toBe(SLOT_STATUS.SELESAI);
  });

  it('auto Selesai +6 jam setelah akhir event (compute on read)', () => {
    const eventEnd = new Date('2020-01-01T10:00:00.000Z');
    const plusSix = eventEndPlusSixMs(eventEnd);
    expect(plusSix).toBe(eventEnd.getTime() + 6 * 60 * 60 * 1000);
    expect(effectiveScheduleStatus({ status: 'CONFIRMED' }, eventEnd)).toBe('DONE');
  });
});
