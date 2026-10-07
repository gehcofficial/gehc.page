import { describe, expect, it } from 'vitest';
import {
  REP_DAY_AGENDA,
  repDayAgendaText,
  repDayAttendeesHint,
  repDayTitle,
} from '../../server/lib/representative-day.mjs';

describe('representative-day: template', () => {
  it('6 agenda 5 divisi + doa', () => {
    expect(REP_DAY_AGENDA).toHaveLength(6);
    const pics = REP_DAY_AGENDA.map((a) => a.pic);
    expect(pics).toContain('Didaskalia');
    expect(pics).toContain('Liturgia');
    expect(pics).toContain('Marturia');
    expect(pics).toContain('Diakonia');
    expect(pics).toContain('Koinonia');
  });

  it('format Judul | PIC | deadline H-1', () => {
    const text = repDayAgendaText('2026-10-18');
    const lines = text.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain(' | Didaskalia | 2026-10-17');
    expect(repDayTitle('Ibadah Raya', '2026-10-18')).toContain('Representative Day');
    expect(repDayAttendeesHint()).toContain('BOD Tim Kerja');
  });
});
