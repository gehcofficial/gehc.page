import { describe, expect, it } from 'vitest';
import {
  REQUEST_STATUSES,
  canTransitionRequest,
  isFinalRequestStatus,
  toDbDate,
} from '../../server/lib/penatalayan-requests.mjs';

describe('request status', () => {
  it('daftar status antrean', () => {
    expect(REQUEST_STATUSES).toEqual(['PENDING', 'FULFILLED', 'CANCELLED']);
  });
  it('PENDING bisa dipenuhi / dibatalkan', () => {
    expect(canTransitionRequest('PENDING', 'FULFILLED')).toBe(true);
    expect(canTransitionRequest('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransitionRequest('PENDING', 'PENDING')).toBe(true);
  });
  it('final tak bisa berubah', () => {
    expect(canTransitionRequest('FULFILLED', 'PENDING')).toBe(false);
    expect(canTransitionRequest('CANCELLED', 'FULFILLED')).toBe(false);
    expect(isFinalRequestStatus('FULFILLED')).toBe(true);
    expect(isFinalRequestStatus('CANCELLED')).toBe(true);
    expect(isFinalRequestStatus('PENDING')).toBe(false);
  });
});

describe('toDbDate', () => {
  it('normalisasi YYYY-MM-DD', () => {
    expect(toDbDate('2026-10-18')).toBe('2026-10-18');
    expect(toDbDate('2026-10-18T03:00:00Z')).toBe('2026-10-18');
    expect(toDbDate('besok')).toBeNull();
    expect(toDbDate('')).toBeNull();
  });
});
