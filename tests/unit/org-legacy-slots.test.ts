import { describe, expect, it } from 'vitest';
import {
  isCanonicalPillarSubdivision,
  isLegacyPantaSlot,
  legacyCanonicalName,
  pillarSlotSlug,
} from '../../server/lib/org-legacy-slots.mjs';

describe('org legacy panca/BZP slots', () => {
  it('maps leftover Diakonia names to the current catalog', () => {
    expect(legacyCanonicalName('DIAKONIA', 'Konsumsi')).toBe('Konsumsi & Keramahan');
    expect(legacyCanonicalName('DIAKONIA', 'Logistik & Akomodasi')).toBe('Logistik & Fasilitas');
    expect(legacyCanonicalName('DIAKONIA', 'Medis & First Aid')).toBe('Kesehatan & Keselamatan');
    expect(legacyCanonicalName('BENZARPR', 'Donation')).toBe('Persembahan & Donasi');
  });

  it('keeps HoD and current catalog names, rejects leftovers', () => {
    expect(isCanonicalPillarSubdivision('DIAKONIA', '')).toBe(true);
    expect(isCanonicalPillarSubdivision('DIAKONIA', 'Konsumsi & Keramahan')).toBe(true);
    expect(isCanonicalPillarSubdivision('DIAKONIA', 'Konsumsi')).toBe(false);
    expect(isCanonicalPillarSubdivision('KOMISI', 'Sekretaris')).toBe(true);
  });

  it('detects leftover slots by subdivision or old slug', () => {
    expect(
      isLegacyPantaSlot({
        nodeKind: 'POSITION_SLOT',
        slug: 'DIAKONIA_KONSUMSI',
        label: 'Konsumsi',
        metadata: { division: 'DIAKONIA', subdivision: 'Konsumsi' },
      }),
    ).toBe(true);
    expect(
      isLegacyPantaSlot({
        nodeKind: 'POSITION_SLOT',
        slug: pillarSlotSlug('DIAKONIA', 'Konsumsi & Keramahan'),
        label: 'Konsumsi & Keramahan',
        metadata: { division: 'DIAKONIA', subdivision: 'Konsumsi & Keramahan' },
      }),
    ).toBe(false);
  });
});
