import { describe, expect, it } from 'vitest';
import {
  resolveRoleKey,
  displayServiceRoleName,
  rolesForPattern,
  buildResponsibleGroupCaption,
  buildBodCaptionLinks,
  ownerScopeForRoleKey,
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
      token: 'tok-abc',
      publicBaseUrl: 'https://youth.gehc.page',
    });
    expect(text).toContain('Liturgos');
    expect(text).toContain('PENANGGUNG JAWAB');
    expect(text).toContain('TUAN RUMAH');
    expect(text).toContain('domain=RESPONSIBLE');
    expect(text).toContain('domain=HOST');
    expect(text).not.toMatch(/Tuan rumah mengisi nama/i);
    expect(text).not.toMatch(/Shyllo/i);
  });

  it('ownerScope HOST untuk peran Koinonia/Diakonia', () => {
    expect(ownerScopeForRoleKey('host-lead')).toBe('HOST');
    expect(ownerScopeForRoleKey('consumption')).toBe('HOST');
    expect(ownerScopeForRoleKey('liturgos')).toBe('RESPONSIBLE');
    expect(ownerScopeForRoleKey('multimedia')).toBe('RESPONSIBLE');
    const hostInPattern = rolesForPattern('CREATIVE_LAB').filter((r) => r.ownerScope === 'HOST');
    expect(hostInPattern.length).toBeGreaterThan(0);
    expect(hostInPattern.every((r) => ['KOINONIA', 'DIAKONIA'].includes(r.division))).toBe(true);
    expect(ownerScopeForRoleKey('decoration')).toBe('HOST');
  });

  it('buildBodCaptionLinks menghasilkan URL absolut per domain', () => {
    const links = buildBodCaptionLinks({
      token: 'x',
      publicBaseUrl: 'https://youth.gehc.page',
      divisionInboxUrl: 'https://youth.gehc.page/#/portal/mentor/division-inbox',
    });
    expect(links?.RESPONSIBLE).toContain('domain=RESPONSIBLE');
    expect(links?.HOST).toContain('domain=HOST');
    expect(links?.divisionInbox).toContain('division-inbox');
  });
});
