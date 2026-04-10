import { describe, expect, it } from 'vitest';
import type { HexCell } from '@/game/types';
import {
  applyManualZoomBias,
  computeFitZoom,
  computeWorldBounds,
} from '@/systems/cameraMath';

function createCell(x: number, y: number): HexCell {
  return {
    coord: { q: x, r: y },
    centerX: x,
    centerY: y,
    unlocked: true,
    type: 'dead',
  };
}

describe('cameraMath', () => {
  it('computes padded world bounds from unlocked cells', () => {
    const bounds = computeWorldBounds(
      [createCell(-50, 10), createCell(120, 90)],
      20,
    );

    expect(bounds).toEqual({
      minX: -70,
      maxX: 140,
      minY: -10,
      maxY: 110,
      centerX: 35,
      centerY: 50,
      width: 210,
      height: 120,
    });
  });

  it('shrinks fit zoom as the world expands', () => {
    const smallBounds = computeWorldBounds([createCell(0, 0), createCell(100, 0)], 20);
    const largeBounds = computeWorldBounds([createCell(0, 0), createCell(800, 0)], 20);

    expect(computeFitZoom(800, 600, largeBounds)).toBeLessThan(
      computeFitZoom(800, 600, smallBounds),
    );
  });

  it('keeps manual zoom bias multiplicative relative to base zoom', () => {
    const zoomedOut = applyManualZoomBias(1, 100, 1, 0.12, 0.75, 1.45);
    const biggerBase = applyManualZoomBias(0.5, 100, 1, 0.12, 0.75, 1.45);

    expect(zoomedOut.manualZoomFactor).toBeCloseTo(biggerBase.manualZoomFactor, 6);
    expect(biggerBase.zoom).toBeCloseTo(zoomedOut.zoom * 0.5, 6);
  });
});
