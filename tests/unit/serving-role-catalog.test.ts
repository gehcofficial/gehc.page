import { describe, expect, it } from 'vitest';
import {
  resolveRoleKey,
  displayServiceRoleName,
  rolesForPattern,
  buildResponsibleGroupCaption,
  WORSHIP_PATTERN_CODES,
} from '../../server/lib/serving-role-catalog.mjs';

describe('serving-role-catalog alias mapping', () => {
  it('memetakan Liturgist - Shyllo ke liturgos', () => {
    expect(resolveRoleKey('Liturgist - Shyllo')).toBe('liturgos');
    expect(displayServiceRoleName('Liturgist - Shyllo')).toBe('Liturgos');
    expect(resolveRoleKey('Pemimpin Liturgi')).toBe('liturgos');
  });

  it('memetakan MC, Main Speaker, Pendoa, Pengumpul', () => {
    expect(resolveRoleKey('MC')).toBe('mc');
    expect(resolveRoleKey('Main Speaker')).toBe('speaker');
    expect(resolveRoleKey('Pendoa')).toBe('intercession');
    expect(resolveRoleKey('Pengumpul')).toBe('offering-collector');
    expect(resolveRoleKey('Operator Multimedia / Siaran Langsung')).toBe('multimedia');
  });

  it('Pembicara Firman selalu Didaskalia; doa di Liturgia', () => {
    const speaker = rolesForPattern('DEBAT').find((r) => r.roleKey === 'speaker');
    expect(speaker?.division).toBe('DIDASKALIA');
    const prayer = rolesForPattern('CREATIVE_LAB').find((r) => r.roleKey === 'offering-prayer');
    expect(prayer?.division).toBe('LITURGIA');
  });
});

describe('daftar usulan per pola', () => {
  it('enam pola terdaftar dengan urutan order', () => {
    expect(WORSHIP_PATTERN_CODES).toHaveLength(6);
    for (const code of WORSHIP_PATTERN_CODES) {
      const rows = rolesForPattern(code);
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.map((r) => r.order)).toEqual(rows.map((_, i) => i + 1));
    }
  });

  it('CREATIVE_LAB: musik opsional', () => {
    const music = rolesForPattern('CREATIVE_LAB').filter((r) => r.roleKey?.startsWith('musician-'));
    expect(music.length).toBeGreaterThan(0);
    expect(music.every((m) => m.optional)).toBe(true);
  });

  it('caption tidak memuat nama orang', () => {
    const text = buildResponsibleGroupCaption({
      dateLabel: 'Minggu, 25 Oktober 2026',
      responsibleGroup: 'Agape',
      hostGroup: 'Shalom',
      patternCode: 'CREATIVE_LAB',
    });
    expect(text).toContain('Liturgos');
    expect(text).not.toMatch(/Shyllo/i);
  });
});
