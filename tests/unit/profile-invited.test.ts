import { describe, expect, it } from 'vitest';
import {
  invitedProfileIncomplete,
  profileIncompleteForUser,
  profileSegments,
} from '../../server/profile-fields.mjs';

describe('profile incomplete invited', () => {
  it('invitedProfileIncomplete true when segments missing', () => {
    const u = {
      onboardingPath: 'INVITED',
      phone: null,
      gender: null,
      birthDate: null,
      giftsTop5: null,
    };
    expect(invitedProfileIncomplete(u)).toBe(true);
  });

  it('profileIncompleteForUser false for WAITING_POOL organic', () => {
    expect(profileIncompleteForUser({ onboardingStatus: 'WAITING_POOL', onboardingPath: 'ORGANIC' })).toBe(false);
  });

  it('invited complete when segments ok', () => {
    const u = {
      onboardingPath: 'INVITED',
      birthDate: new Date('2000-01-01'),
      phone: '08123456789',
      gender: 'LAKI-LAKI',
      addressLine: 'Jl. Test',
      city: 'Cikarang',
      province: 'Jabar',
      giftsTop5: ['A', 'B', 'C', 'D', 'E'],
      lifeStatuses: ['WORK'],
      workplaceName: 'GEHC',
      workIndustry: 'IT & Teknologi',
    };
    expect(profileSegments(u).contact).toBe(true);
    expect(invitedProfileIncomplete(u)).toBe(false);
  });
});
