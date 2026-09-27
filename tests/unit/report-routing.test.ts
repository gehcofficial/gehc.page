import { describe, it, expect } from 'vitest';
import {
  currentPeriodKeys,
  isReportHash,
  isoWeekKey,
  parseReportHash,
  reportAbsoluteUrl,
  reportHashPath,
  unitCodeForPortal,
} from '../../src/lib/report-routing';

describe('report-routing', () => {
  it('parse rute kas/fasilitas/bpmj (bulan & minggu)', () => {
    expect(parseReportHash('#/laporan/kas/2026-09')).toMatchObject({ kind: 'kas', period: '2026-09' });
    expect(parseReportHash('#/laporan/kas/2026-W38')).toMatchObject({ kind: 'kas', period: '2026-W38' });
    expect(parseReportHash('#/laporan/fasilitas/2026-09')).toMatchObject({ kind: 'fasilitas' });
    expect(parseReportHash('#/laporan/bpmj/2026-09')).toMatchObject({ kind: 'bpmj' });
  });

  it('parse rute unit butuh kode unit', () => {
    expect(parseReportHash('#/laporan/unit/pemuda/2026-09')).toMatchObject({ kind: 'unit', unit: 'PEMUDA', period: '2026-09' });
    expect(parseReportHash('#/laporan/unit/2026-09')).toBeNull();
  });

  it('tolak rute tak valid', () => {
    expect(parseReportHash('#/laporan')).toBeNull();
    expect(parseReportHash('#/laporan/bogus/2026-09')).toBeNull();
    expect(parseReportHash('#/laporan/kas/2026')).toBeNull();
    expect(parseReportHash('#/portal/komisi/dashboard')).toBeNull();
  });

  it('isReportHash & path/url', () => {
    expect(isReportHash('#/laporan/kas/2026-09')).toBe(true);
    expect(isReportHash('#/portal')).toBe(false);
    expect(reportHashPath({ kind: 'kas', period: '2026-w38' })).toBe('#/laporan/kas/2026-W38');
    expect(reportHashPath({ kind: 'unit', unit: 'pemuda', period: '2026-09' })).toBe('#/laporan/unit/PEMUDA/2026-09');
    expect(reportAbsoluteUrl({ kind: 'kas', period: '2026-09' }, 'https://gehc.page')).toBe('https://gehc.page/#/laporan/kas/2026-09');
  });

  it('unitCodeForPortal & kunci periode', () => {
    expect(unitCodeForPortal('youth')).toBe('PEMUDA');
    expect(unitCodeForPortal('men')).toBe('BAPAK');
    expect(unitCodeForPortal('kolom')).toBe('KOLOM');
    expect(unitCodeForPortal('jemaat')).toBe('JEMAAT');
    const keys = currentPeriodKeys(new Date('2026-01-01T00:00:00Z'));
    expect(keys.month).toBe('2026-01');
    expect(keys.week).toMatch(/^2026-W\d{2}$/);
    expect(isoWeekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });
});
