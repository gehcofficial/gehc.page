import { describe, it, expect } from 'vitest';
import { isWelcomeRole, shouldShowWelcome, welcomeDismissKey } from '../../src/lib/welcome';
import { dictionaries } from '../../src/i18n';

describe('welcome', () => {
  it('role Beyonders dikenali', () => {
    expect(isWelcomeRole('MENTEE')).toBe(true);
    expect(isWelcomeRole('mentor')).toBe(true);
    expect(isWelcomeRole('CO_MENTOR')).toBe(true);
    expect(isWelcomeRole('KOMISI')).toBe(false);
  });

  it('tampil hanya bila role + grup + belum dismiss', () => {
    expect(shouldShowWelcome({ role: 'MENTEE', groupId: 'grp-1' })).toBe(true);
    expect(shouldShowWelcome({ role: 'MENTEE', groupId: 'grp-1', dismissed: true })).toBe(false);
    expect(shouldShowWelcome({ role: 'MENTEE', groupId: null })).toBe(false);
    expect(shouldShowWelcome({ role: 'KOMISI', groupId: 'grp-1' })).toBe(false);
  });

  it('kunci dismiss per user+grup', () => {
    expect(welcomeDismissKey('u1', 'grp-1')).toBe('gehc_welcome_u1_grp-1');
    expect(welcomeDismissKey('u1', 'grp-2')).not.toBe(welcomeDismissKey('u1', 'grp-1'));
  });

  it('greeting i18n ada (ID/EN)', () => {
    expect(dictionaries.id.portal.dashboard.greeting).toContain('{name}');
    expect(dictionaries.en.portal.dashboard.greeting).toContain('{name}');
    expect(dictionaries.id.portal.welcome.title).toContain('{name}');
  });
});
