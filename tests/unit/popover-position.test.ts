import { describe, it, expect } from 'vitest';
import { popoverPosition } from '../../src/lib/popover-position';

const button = { top: 400, right: 900, bottom: 440, left: 860, width: 40, height: 40 };

describe('popoverPosition', () => {
  it('places the panel below the trigger when there is room', () => {
    const pos = popoverPosition(button, { width: 1200, height: 900 });
    expect(pos.top).toBeGreaterThan(button.bottom);
    expect(pos.left + pos.width).toBeLessThanOrEqual(1200);
    expect(pos.maxHeight).toBeGreaterThan(200);
  });

  it('flips above the trigger near the bottom of the viewport', () => {
    const low = { top: 820, right: 900, bottom: 860, left: 860, width: 40, height: 40 };
    const pos = popoverPosition(low, { width: 1200, height: 900 });
    expect(pos.top).toBeLessThan(low.top);
    expect(pos.maxHeight).toBeGreaterThan(160);
  });

  it('keeps the panel inside a narrow viewport', () => {
    const pos = popoverPosition(button, { width: 360, height: 700 }, { panelWidth: 448 });
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + pos.width).toBeLessThanOrEqual(360 - 8);
  });
});
