import { describe, it, expect } from 'vitest';
import {
  SHOTLIST_DEFAULTS,
  isAssetStatus,
  isSoulStatus,
  makeReferralCode,
  nextAssetStatus,
  referralCodeFromHash,
  referralLink,
} from '../../src/lib/marturia';
import {
  isCaseKind,
  isCaseStatus,
  isCheckArea,
  isCheckStatus,
  nextCaseStatus,
  summarizeReadiness,
} from '../../src/lib/diakonia';

describe('marturia lib', () => {
  it('shotlist default 6 item liputan', () => {
    expect(SHOTLIST_DEFAULTS).toHaveLength(6);
    expect(SHOTLIST_DEFAULTS[0]).toMatch(/venue/i);
  });

  it('alur asset maju satu langkah, terminal HANDOFF', () => {
    expect(nextAssetStatus('DIMINTA')).toBe('DIGARAP');
    expect(nextAssetStatus('FINAL')).toBe('HANDOFF');
    expect(nextAssetStatus('HANDOFF')).toBeNull();
    expect(nextAssetStatus('NGACO')).toBeNull();
  });

  it('status guard asset & soul', () => {
    expect(isAssetStatus('REVIEW')).toBe(true);
    expect(isAssetStatus('HAPUS')).toBe(false);
    expect(isSoulStatus('DISERAHKAN')).toBe(true);
    expect(isSoulStatus('HILANG')).toBe(false);
  });

  it('kode referral unik format GB-XXXXXX tanpa karakter ambigu', () => {
    const codes = new Set(Array.from({ length: 50 }, () => makeReferralCode()));
    expect(codes.size).toBeGreaterThan(40);
    for (const c of codes) {
      expect(c).toMatch(/^GB-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('referral link menempel origin + code', () => {
    expect(referralLink('GB-ABC123', 'https://x.test/')).toBe('https://x.test/#/join?ref=GB-ABC123');
  });

  it('referralCodeFromHash: hanya GB-XXXXXX valid yang lolos', () => {
    expect(referralCodeFromHash('#/register?ref=GB-ABC234')).toBe('GB-ABC234');
    expect(referralCodeFromHash('#/join?ref=gb-abc234')).toBe('GB-ABC234');
    expect(referralCodeFromHash('#/register')).toBeNull();
    expect(referralCodeFromHash('#/register?ref=NGACO')).toBeNull();
    expect(referralCodeFromHash('#/register?ref=GB-ABC12')).toBeNull();
    expect(referralCodeFromHash('#/register?ref=GB-ABC123')).toBeNull(); // 1 ambigu → ditolak
    expect(referralCodeFromHash('')).toBeNull();
  });
});

describe('diakonia lib', () => {
  it('guard area & status check', () => {
    expect(isCheckArea('LOGISTIK')).toBe(true);
    expect(isCheckArea('PARKIR')).toBe(false);
    expect(isCheckStatus('KENDALA')).toBe(true);
    expect(isCheckStatus('AMAN')).toBe(false);
  });

  it('readiness: kendala menang, belum bila kosong', () => {
    expect(summarizeReadiness([]).overall).toBe('BELUM');
    expect(
      summarizeReadiness([
        { area: 'LOGISTIK', status: 'SIAP' },
        { area: 'KONSUMSI', status: 'SIAP' },
        { area: 'KESEHATAN', status: 'SIAP' },
      ]).overall,
    ).toBe('SIAP');
    const r = summarizeReadiness([
      { area: 'LOGISTIK', status: 'SIAP' },
      { area: 'KONSUMSI', status: 'KENDALA' },
    ]);
    expect(r.overall).toBe('KENDALA');
    expect(r.siap).toBe(1);
    expect(r.kendala).toBe(1);
    expect(r.belum).toBe(1);
  });

  it('alur kasus mercy maju satu langkah, terminal TUTUP', () => {
    expect(nextCaseStatus('LAPOR')).toBe('ASSESS');
    expect(nextCaseStatus('FOLLOWUP')).toBe('TUTUP');
    expect(nextCaseStatus('TUTUP')).toBeNull();
    expect(nextCaseStatus('BATAL')).toBeNull();
  });

  it('guard status & jenis kasus', () => {
    expect(isCaseStatus('BANTUAN')).toBe(true);
    expect(isCaseStatus('SELESAI')).toBe(false);
    expect(isCaseKind('SAKIT')).toBe(true);
    expect(isCaseKind('RICH')).toBe(false);
  });
});
