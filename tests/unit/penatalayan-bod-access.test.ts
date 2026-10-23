import { describe, expect, it } from 'vitest';
import { isBodCoordinator } from '../../server/lib/penatalayan-bod-access.mjs';

describe('penatalayan BOD RBAC helpers', () => {
  it('Komisi dianggap koordinator BOD', () => {
    expect(isBodCoordinator({ roles: [{ role: 'KOMISI' }] })).toBe(true);
    expect(isBodCoordinator({ roles: [{ role: 'MENTOR' }] })).toBe(false);
  });
});
