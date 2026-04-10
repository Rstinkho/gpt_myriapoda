import { describe, expect, it } from 'vitest';
import { resolvePlantAnchorInHex } from '@/entities/plants/plantPlacement';
import { tuning } from '@/game/tuning';
import type { HexCell } from '@/game/types';

const cell: HexCell = {
  coord: { q: 0, r: 0 },
  centerX: 120,
  centerY: 80,
  unlocked: true,
  type: 'purified',
};

describe('plantPlacement', () => {
  it('can place a plant away from the cell center', () => {
    const anchor = resolvePlantAnchorInHex(cell, 0, 1);

    expect(anchor.x).toBeCloseTo(cell.centerX + tuning.plantHexSpawnRadiusXPx, 5);
    expect(anchor.y).toBeCloseTo(cell.centerY + tuning.plantRootOffsetYPx, 5);
  });

  it('keeps the plant anchor within the configured in-hex placement range', () => {
    const anchor = resolvePlantAnchorInHex(cell, 0.375, 1);

    expect(Math.abs(anchor.x - cell.centerX)).toBeLessThanOrEqual(
      tuning.plantHexSpawnRadiusXPx,
    );
    expect(
      Math.abs(anchor.y - (cell.centerY + tuning.plantRootOffsetYPx)),
    ).toBeLessThanOrEqual(tuning.plantHexSpawnRadiusYPx);
  });
});
