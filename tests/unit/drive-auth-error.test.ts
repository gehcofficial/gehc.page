import { describe, it, expect } from 'vitest';
import { isDriveAuthError, driveAuthErrorMessage } from '../../server/lib/gdrive-user-oauth.mjs';

describe('isDriveAuthError', () => {
  it('mengenali invalid_grant dari message', () => {
    expect(isDriveAuthError(new Error('invalid_grant: Token has been expired or revoked.'))).toBe(true);
  });

  it('mengenali invalid_client / unauthorized_client', () => {
    expect(isDriveAuthError({ code: 'invalid_client' })).toBe(true);
    expect(isDriveAuthError({ response: { data: { error: 'unauthorized_client' } } })).toBe(true);
  });

  it('mengenali error_description Google', () => {
    expect(
      isDriveAuthError({ response: { data: { error_description: 'Token has been expired or revoked' } } }),
    ).toBe(true);
  });

  it('menolak error biasa (kuota, 404, network)', () => {
    expect(isDriveAuthError(new Error('File not found.'))).toBe(false);
    expect(isDriveAuthError(new Error('Rate Limit Exceeded'))).toBe(false);
    expect(isDriveAuthError(null)).toBe(false);
    expect(isDriveAuthError(undefined)).toBe(false);
  });

  it('pesan ramah menyebut langkah admin', () => {
    expect(driveAuthErrorMessage()).toContain('npm run drive:auth');
  });
});
