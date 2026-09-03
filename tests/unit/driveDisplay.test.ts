import { describe, expect, it } from 'vitest';
import { displayFolderName } from '../../src/lib/driveDisplay';

describe('displayFolderName', () => {
  it('strips zone tags', () => {
    expect(displayFolderName('Liturgia [MENTOR]')).toBe('Liturgia');
    expect(displayFolderName('Website Visual [PUBLIK]')).toBe('Website Visual');
    expect(displayFolderName('RUACH [GROUP:RUACH]')).toBe('RUACH');
    expect(displayFolderName('Arsip Generasi [ALUMNI]')).toBe('Arsip Generasi');
  });

  it('keeps untagged names', () => {
    expect(displayFolderName('landing')).toBe('landing');
  });
});
