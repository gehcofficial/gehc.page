import { describe, expect, it } from 'vitest';
import {
  normalizeUsername,
  slugUsernameFromName,
  validateUsername,
} from '../../server/lib/username.mjs';

describe('username', () => {
  it('normalizeUsername lowercases and strips', () => {
    expect(normalizeUsername('  Budi.Wanget  ')).toBe('budi.wanget');
  });

  it('slugUsernameFromName generates valid base', () => {
    const s = slugUsernameFromName('Pnt Budi Wanget');
    expect(s.length).toBeGreaterThanOrEqual(4);
    expect(validateUsername(s)).toBeNull();
  });

  it('validateUsername rejects reserved', () => {
    expect(validateUsername('admin')).toMatch(/tidak tersedia/);
  });

  it('validateUsername accepts good username', () => {
    expect(validateUsername('mentor.avodah')).toBeNull();
  });
});
