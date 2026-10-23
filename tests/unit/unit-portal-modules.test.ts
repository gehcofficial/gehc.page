import { describe, expect, it } from 'vitest';
import { unitPortalModules, unitPortalTagline } from '../../src/lib/unit-portal-modules';

describe('unit-portal-modules', () => {
  it('exposes kolom module on kolom portal', () => {
    const tabs = unitPortalModules('kolom').map((m) => m.tab);
    expect(tabs).toContain('kolom');
    expect(tabs).toContain('unit-members');
  });

  it('BPMJ dashboard only on jemaat with role gate', () => {
    const jemaat = unitPortalModules('jemaat');
    const dash = jemaat.find((m) => m.id === 'bpmj-dash');
    expect(dash?.tab).toBe('church-dashboard');
    expect(dash?.roles).toContain('BPMJ');
  });

  it('taglines are non-empty for unit portals', () => {
    expect(unitPortalTagline('men').length).toBeGreaterThan(10);
    expect(unitPortalTagline('teen').length).toBeGreaterThan(10);
  });
});
