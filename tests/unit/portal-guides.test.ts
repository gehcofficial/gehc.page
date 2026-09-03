import { describe, expect, it } from 'vitest';
import { portalEn } from '../../src/i18n/portal-en';
import { portalId } from '../../src/i18n/portal-id';
import { buildPortalNavItems, getAllPortalNavDefs } from '../../src/lib/portal-nav-config';
import { portalGuide } from '../../src/lib/portal-i18n';
import { dictionaries } from '../../src/i18n';

const EXTRA_GUIDE_IDS = [
  'account.profile',
  'account.security',
  'account.roles',
  'account.notifications',
  'people.akun',
  'people.provision',
  'people.access-groups',
  'people.invite',
  'onboarding.registered',
  'onboarding.waiting',
  'onboarding.pending',
  'events.events',
  'events.calendar',
  'events.umbrella',
  'events.month',
];

describe('portal i18n + guides', () => {
  it('en and id portal trees have the same keys at the top level', () => {
    expect(Object.keys(portalId).sort()).toEqual(Object.keys(portalEn).sort());
    expect(Object.keys(portalId.guides).sort()).toEqual(Object.keys(portalEn.guides).sort());
    expect(Object.keys(portalId.nav).sort()).toEqual(Object.keys(portalEn.nav).sort());
  });

  it('every sidebar nav id has a guide', () => {
    for (const item of getAllPortalNavDefs()) {
      expect(portalEn.guides[item.id as keyof typeof portalEn.guides], item.id).toBeTruthy();
      expect(portalGuide(dictionaries.en, item.id)?.purpose.length).toBeGreaterThan(10);
      expect(portalGuide(dictionaries.id, item.id)?.purpose.length).toBeGreaterThan(10);
    }
  });

  it('inner-tab guides exist', () => {
    for (const id of EXTRA_GUIDE_IDS) {
      expect(portalGuide(dictionaries.en, id), id).toBeTruthy();
      expect(portalGuide(dictionaries.id, id), id).toBeTruthy();
    }
  });

  it('mentor help catalog excludes Komisi menus', () => {
    const items = buildPortalNavItems('MENTOR', { isGroupMentor: true, isMentee: false }, false);
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain('people');
    expect(ids).not.toContain('youth-gehc');
    expect(ids).not.toContain('onboarding');
    expect(ids).toContain('groups-monitoring');
    expect(ids).toContain('account');
  });
});
