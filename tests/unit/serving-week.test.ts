import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  parseWeekDate,
  resolveMentoringDayHods,
  serializeWeekChannel,
  validateWaUrl,
} from '../../server/lib/serving-week.mjs';
import {
  buildServingCloseCaption,
  buildServingInviteCaption,
  buildServingRosterText,
  buildToolHowtoCaption,
} from '../../src/lib/serving-week-caption';

describe('serving-week: siklus status', () => {
  it('DRAFT → OPEN → CLOSED; CLOSED final', () => {
    expect(canTransition('DRAFT', 'OPEN')).toBe(true);
    expect(canTransition('OPEN', 'CLOSED')).toBe(true);
    expect(canTransition('DRAFT', 'CLOSED')).toBe(false);
    expect(canTransition('CLOSED', 'OPEN')).toBe(false);
    expect(() => assertTransition('CLOSED', 'OPEN')).toThrow();
  });

  it('tanggal & link divalidasi', () => {
    expect(parseWeekDate('2026-10-18')).toBe('2026-10-18');
    expect(() => parseWeekDate('18-10-2026')).toThrow();
    expect(validateWaUrl('https://chat.whatsapp.com/AbCdEf123')).toContain('chat.whatsapp.com');
    expect(validateWaUrl(null)).toBeNull();
    expect(() => validateWaUrl('https://example.com/grup')).toThrow();
  });

  it('serialize toleran camel/snake', () => {
    const c = serializeWeekChannel({ id: 'x', event_date: '2026-10-18', status: 'OPEN', representative_ids: '["u1"]' });
    expect(c?.eventDate).toBe('2026-10-18');
    expect(c?.representativeIds).toEqual(['u1']);
    expect(serializeWeekChannel(null)).toBeNull();
  });
});

const INVITE = {
  serving: {
    responsibleGroup: { name: 'Echad' },
    hostGroup: { name: 'Ruach' },
    event: { name: 'Ibadah Raya' },
  },
  officers: [{ name: 'Andi', component: 'Pemimpin Pujian' }],
  mentors: [{ name: 'Sari', groupName: 'Echad' }],
  hods: [{ name: 'Holly', division: 'LITURGIA' }],
};

describe('serving-week: caption', () => {
  it('undangan memuat penanggung, link, dan ajakan konfirmasi', () => {
    const t = buildServingInviteCaption({ date: '2026-10-18', waUrl: 'https://chat.whatsapp.com/X', invite: INVITE });
    expect(t).toContain('Echad');
    expect(t).toContain('https://chat.whatsapp.com/X');
    expect(t).toContain('Konfirmasi');
    expect(t).toContain('TEMPORER');
  });

  it('roster tanpa nomor HP; penutup berisi arsip + keluar', () => {
    const r = buildServingRosterText(INVITE);
    expect(r).toContain('Andi — Pemimpin Pujian');
    expect(r).toContain('Sari (Echad)');
    expect(r).toContain('Holly (LITURGIA)');
    expect(buildServingCloseCaption({ date: '2026-10-18', invite: INVITE })).toContain('keluar dari grup');
  });

  it('cara kerja: konfirmasi + checklist + QR bukan QRIS', () => {
    const t = buildToolHowtoCaption({});
    expect(t).toContain('Konfirmasi');
    expect(t).toContain('QRIS');
    expect(t).toContain('@BOD');
  });
});

describe('serving-week: HOD mentoring day', () => {
  const mkPrisma = (events: unknown[], leads: unknown[]) => ({
    eventProgram: { findMany: async () => events },
    eventDivisionMember: { findMany: async () => leads },
  });

  it('mengambil HOD event MENTORING_DAY tanggal WIB + dedupe', async () => {
    const events = [
      { id: 'ev-ment', eventDate: new Date('2026-10-18T02:00:00.000Z'), serviceType: 'MENTORING_DAY' },
      { id: 'ev-srv', eventDate: new Date('2026-10-18T02:00:00.000Z'), serviceType: 'SERVING_DAY' },
    ];
    const leads = [
      { userId: 'u1', role: 'LEAD', user: { name: 'Holly' }, eventDivision: { division: 'LITURGIA' } },
      { userId: 'u2', role: 'CO_LEAD', user: { name: 'Yosef' }, eventDivision: { division: 'DIDASKALIA' } },
      { userId: 'u1', role: 'LEAD', user: { name: 'Holly' }, eventDivision: { division: 'LITURGIA' } },
    ];
    const out = await resolveMentoringDayHods(mkPrisma(events, leads) as never, '2026-10-18');
    expect(out.map((h) => `${h.userId}:${h.role}`)).toEqual(['u1:LEAD', 'u2:CO_LEAD']);
    expect(out[0].division).toBe('LITURGIA');
  });

  it('tanpa event mentoring / tanggal rusak = kosong', async () => {
    const events = [{ id: 'ev-srv', eventDate: new Date('2026-10-18T02:00:00.000Z'), serviceType: 'SERVING_DAY' }];
    expect(await resolveMentoringDayHods(mkPrisma(events, []) as never, '2026-10-18')).toEqual([]);
    expect(await resolveMentoringDayHods(mkPrisma(events, []) as never, 'ngaco')).toEqual([]);
    expect(await resolveMentoringDayHods(null as never, '2026-10-18')).toEqual([]);
  });
});
