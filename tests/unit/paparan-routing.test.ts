import { describe, it, expect } from 'vitest';
import {
  PAPARAN_SLUGS,
  isPaparanHash,
  paparanHashPath,
  parsePaparanHash,
} from '../../src/lib/paparan-routing';
import { isPaparanHash as isPaparanHostHash } from '../../src/lib/host-context';

describe('paparan-routing', () => {
  it('parse slug terdaftar', () => {
    expect(parsePaparanHash('#/paparan/bpmj-2026-10')).toMatchObject({ slug: 'bpmj-2026-10', path: '#/paparan/bpmj-2026-10' });
  });

  it('tolak slug tak terdaftar & rute lain', () => {
    expect(parsePaparanHash('#/paparan')).toBeNull();
    expect(parsePaparanHash('#/paparan/rahasia')).toBeNull();
    expect(parsePaparanHash('#/laporan/bpmj/2026-09')).toBeNull();
    expect(parsePaparanHash('#/portal/komisi/dashboard')).toBeNull();
  });

  it('isPaparanHash & path konsisten host-context', () => {
    expect(isPaparanHash('#/paparan/bpmj-2026-10')).toBe(true);
    expect(isPaparanHash('#/paparan/rahasia')).toBe(false);
    expect(isPaparanHostHash('#/paparan/bpmj-2026-10')).toBe(true);
    expect(isPaparanHostHash('#/portal')).toBe(false);
    expect(paparanHashPath('BPMJ-2026-10')).toBe('#/paparan/bpmj-2026-10');
    expect(PAPARAN_SLUGS).toContain('bpmj-2026-10');
  });
});
