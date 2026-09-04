import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { generateProvisionPassword, resolveUniformPassword } from '../../server/invite-provision.mjs';

describe('invite-provision', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    process.env.GEHC_ENV = 'staging';
    delete process.env.PROVISION_UNIFORM_PASSWORD;
    delete process.env.DEMO_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...orig };
  });

  it('generateProvisionPassword has GehC prefix', () => {
    expect(generateProvisionPassword()).toMatch(/^GehC-[a-f0-9]{8}!$/);
  });

  it('resolveUniformPassword returns null when disabled', () => {
    expect(resolveUniformPassword({})).toBeNull();
    expect(resolveUniformPassword({ useUniformPassword: false })).toBeNull();
  });

  it('resolveUniformPassword uses explicit password', () => {
    expect(resolveUniformPassword({ useUniformPassword: true, uniformPassword: 'password123' })).toBe('password123');
  });

  it('resolveUniformPassword defaults to GEHCikarang when uniform is on', () => {
    expect(resolveUniformPassword({ useUniformPassword: true })).toBe('GEHCikarang');
  });

  it('resolveUniformPassword falls back to env', () => {
    process.env.PROVISION_UNIFORM_PASSWORD = 'staging-pass-99';
    expect(resolveUniformPassword({ useUniformPassword: true })).toBe('staging-pass-99');
  });

  it('resolveUniformPassword rejects short password', () => {
    expect(() => resolveUniformPassword({ useUniformPassword: true, uniformPassword: 'short' })).toThrow(
      /minimal 8/,
    );
  });

  it('resolveUniformPassword blocks custom password in production', () => {
    process.env.GEHC_ENV = 'production';
    process.env.PROVISION_UNIFORM_PASSWORD = 'vault-secret-99';
    expect(() =>
      resolveUniformPassword({ useUniformPassword: true, uniformPassword: 'other-pass-99' }),
    ).toThrow(/production/);
    expect(resolveUniformPassword({ useUniformPassword: true, uniformPassword: 'vault-secret-99' })).toBe(
      'vault-secret-99',
    );
    expect(resolveUniformPassword({ useUniformPassword: true, uniformPassword: 'GEHCikarang' })).toBe('GEHCikarang');
  });
});
