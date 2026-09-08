import { describe, it, expect } from 'vitest';
import { validateShowIf } from '../../server/lib/event-question-bank.mjs';
import { isQuestionVisible } from '../../server/lib/event-question-showif.mjs';

describe('validateShowIf', () => {
  it('null = selalu tampil', () => {
    expect(validateShowIf(null)).toEqual({ ok: true, rule: null });
    expect(validateShowIf(undefined)).toEqual({ ok: true, rule: null });
  });

  it('menerima equals string', () => {
    expect(validateShowIf({ key: 'status_kerja', equals: 'Aktif Kuliah' })).toEqual({
      ok: true,
      rule: { key: 'status_kerja', equals: 'Aktif Kuliah' },
    });
  });

  it('menerima equals boolean dan in array', () => {
    expect(validateShowIf({ key: 'ikut_makan', equals: true }).ok).toBe(true);
    const r = validateShowIf({ key: 'asal_jemaat', in: ['GMIM lain', 'Gereja non-GMIM'] });
    expect(r.ok).toBe(true);
  });

  it('menolak tanpa key / tanpa equals-in / self-reference', () => {
    expect(validateShowIf({ equals: 'x' }).ok).toBe(false);
    expect(validateShowIf({ key: 'a' }).ok).toBe(false);
    expect(validateShowIf({ key: 'a', equals: 'x' }, { selfKey: 'a' }).ok).toBe(false);
  });

  it('menolak kunci acuan yang tidak ada di bank', () => {
    expect(validateShowIf({ key: 'ngaco', equals: 'x' }, { bankKeys: ['status_kerja'] }).ok).toBe(false);
    expect(validateShowIf({ key: 'status_kerja', equals: 'x' }, { bankKeys: ['status_kerja'] }).ok).toBe(true);
  });

  it('menerima JSON string', () => {
    const r = validateShowIf(JSON.stringify({ key: 'status_kerja', in: ['Bekerja'] }));
    expect(r).toEqual({ ok: true, rule: { key: 'status_kerja', in: ['Bekerja'] } });
    expect(validateShowIf('{ngaco').ok).toBe(false);
  });
});

describe('isQuestionVisible (alur showIf)', () => {
  const angkatan = { key: 'angkatan', showIf: { key: 'status_kerja', equals: 'Aktif Kuliah' } };
  const bidang = { key: 'bidang', showIf: { key: 'status_kerja', equals: 'Bekerja' } };

  it('angkatan tampil bila Aktif Kuliah', () => {
    expect(isQuestionVisible(angkatan, { status_kerja: 'Aktif Kuliah' })).toBe(true);
    expect(isQuestionVisible(angkatan, { status_kerja: 'Bekerja' })).toBe(false);
    expect(isQuestionVisible(bidang, { status_kerja: 'Bekerja' })).toBe(true);
  });

  it('tanpa jawaban acuan = tersembunyi', () => {
    expect(isQuestionVisible(angkatan, {})).toBe(false);
  });
});
