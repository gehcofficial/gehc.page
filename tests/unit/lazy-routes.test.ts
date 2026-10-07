import { describe, expect, it } from 'vitest';
import { parseLiturgyHash } from '../../src/lib/liturgy-live';

/**
 * Anti-regresi React #306 ("Lazy element type must resolve to a class or
 * function"): setiap modul yang di-React.lazy di src/main.tsx WAJIB punya
 * default export function. tsc + vite build tidak menangkap ini.
 */
const LAZY_ROUTE_MODULES = [
  '../../src/components/hub/ChurchHub.tsx',
  '../../src/components/unit/UnitLanding.tsx',
  '../../src/components/hub/PitchDeck.tsx',
  '../../src/components/hub/PitchMentor.tsx',
  '../../src/components/didaskalia/DidaskaliaPresentation.tsx',
  '../../src/components/reports/ReportPresentation.tsx',
  '../../src/components/voting/GroupLogoVote.tsx',
  '../../src/components/pelsus/PelsusApp.tsx',
  '../../src/components/mentoring/MentoringDay.tsx',
  '../../src/components/mentoring/MentoringScreen.tsx',
  '../../src/components/mentoring/MentoringControl.tsx',
  '../../src/components/liturgy/LiturgyScreen.tsx',
  '../../src/components/liturgy/LiturgyControl.tsx',
];

describe('lazy-routes: default export untuk React.lazy', () => {
  it.each(LAZY_ROUTE_MODULES)('%s mengekspor default function', async (path) => {
    const mod = (await import(path)) as { default?: unknown };
    expect(typeof mod.default, `${path} butuh export default (React.lazy)`).toBe('function');
  });
});

describe('liturgy-hash: bentuk rute prod', () => {
  it('slug event asli terurai ke layar/kontrol', () => {
    const slug = 'ibadah-pemuda-raya-the-rescue-plan-11-ok-mur3tp1ofl';
    expect(parseLiturgyHash(`#\/ibadah\/${slug}\/layar`)).toEqual({ eventKey: slug, view: 'layar' });
    expect(parseLiturgyHash(`#\/ibadah\/${slug}\/kontrol`)).toEqual({ eventKey: slug, view: 'kontrol' });
    expect(parseLiturgyHash('#/portal')).toBeNull();
  });
});
