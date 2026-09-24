import { describe, expect, it } from 'vitest';
import {
  canTransition,
  canActorTransition,
  auditPatch,
  isTerminal,
} from '../../server/lib/penatalayan-status.mjs';

describe('penatalayan status transitions', () => {
  it('alur utama SCHEDULED → CONFIRMED → DONE', () => {
    expect(canTransition('SCHEDULED', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'DONE')).toBe(true);
    expect(canTransition('SCHEDULED', 'DONE')).toBe(false);
  });

  it('revert & batal', () => {
    expect(canTransition('CONFIRMED', 'SCHEDULED')).toBe(true);
    expect(canTransition('CANCELLED', 'SCHEDULED')).toBe(true);
    expect(canTransition('SCHEDULED', 'CANCELLED')).toBe(true);
    expect(canTransition('DONE', 'SCHEDULED')).toBe(false);
  });

  it('DONE = terminal', () => {
    expect(isTerminal('DONE')).toBe(true);
    expect(isTerminal('CONFIRMED')).toBe(false);
  });

  it('petugas boleh konfirmasi & kembalikan, bukan DONE/batal', () => {
    expect(canActorTransition('SCHEDULED', 'CONFIRMED', {}).ok).toBe(true);
    expect(canActorTransition('CONFIRMED', 'SCHEDULED', {}).ok).toBe(true);
    expect(canActorTransition('CONFIRMED', 'DONE', {}).ok).toBe(false);
    expect(canActorTransition('SCHEDULED', 'CANCELLED', {}).ok).toBe(false);
  });

  it('koordinator boleh DONE & batal; DONE terkunci kecuali SUPERADMIN', () => {
    expect(canActorTransition('CONFIRMED', 'DONE', { isCoordinator: true }).ok).toBe(true);
    expect(canActorTransition('SCHEDULED', 'CANCELLED', { isCoordinator: true }).ok).toBe(true);
    const locked = canActorTransition('DONE', 'SCHEDULED', { isCoordinator: true });
    expect(locked.ok).toBe(false);
    expect(canActorTransition('DONE', 'SCHEDULED', { isCoordinator: true, isSuperadmin: true }).ok).toBe(true);
  });

  it('auditPatch mengisi/membersihkan jejak waktu', () => {
    const toDone = auditPatch('CONFIRMED', 'DONE', 'usr-1');
    expect(toDone.doneById).toBe('usr-1');
    expect(toDone.doneAt).toBeInstanceOf(Date);
    const revert = auditPatch('DONE', 'SCHEDULED', 'usr-2');
    expect(revert.doneAt).toBeNull();
    expect(revert.doneById).toBeNull();
  });
});
