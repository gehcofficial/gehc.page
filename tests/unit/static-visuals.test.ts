import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  VISUALS_DIR,
  staticUrl,
  validateStaticSlots,
  emptySlots,
  assignSlot,
} from '../../server/lib/static-visuals.mjs';

describe('static-visuals', () => {
  const pngPath = join(VISUALS_DIR, 'landing', '01-hero-banner.png');

  afterEach(() => {
    if (existsSync(pngPath)) rmSync(pngPath, { force: true });
  });

  it('staticUrl adds cache buster', () => {
    expect(staticUrl('landing/01-hero-banner.png', 123)).toBe('/visuals/landing/01-hero-banner.png?v=123');
  });

  it('assignSlot nests by key', () => {
    const slots = emptySlots();
    assignSlot(slots, 'landing.heroBanner', '/visuals/landing/01-hero-banner.png?v=1');
    expect(slots.landing.heroBanner).toBe('/visuals/landing/01-hero-banner.png?v=1');
  });

  it('validateStaticSlots drops missing files', () => {
    mkdirSync(join(VISUALS_DIR, 'landing'), { recursive: true });
    writeFileSync(pngPath, 'x');
    const slots = emptySlots();
    assignSlot(slots, 'landing.heroBanner', staticUrl('landing/01-hero-banner.png', 1));
    assignSlot(slots, 'landing.collageWorship', staticUrl('landing/missing.png', 1));
    const result = validateStaticSlots({ slots, syncedAt: '2026-01-01' });
    expect(result?.slots.landing.heroBanner).toMatch(/01-hero-banner\.png\?v=/);
    expect(result?.slots.landing.collageWorship).toBeUndefined();
  });
});
