import { describe, expect, it } from 'vitest';
import {
  computeParallaxOffset,
  createBackdropReactivitySample,
  getCorruptionAnchorCap,
  getBackdropHexFillRadius,
  sampleBackdropDensity,
  sampleBioWebHexOcclusion,
  selectCorruptionAnchors,
  selectLivingAnchors,
} from '@/background/backgroundMath';
import type { HexCell, WorldRenderSnapshot } from '@/game/types';

function createCell(
  q: number,
  r: number,
  type: HexCell['type'],
  overrides: Partial<HexCell> = {},
): HexCell {
  return {
    coord: { q, r },
    centerX: q * 120,
    centerY: r * 120,
    unlocked: true,
    type,
    ...overrides,
  };
}

function createSnapshot(cells: HexCell[], stage = 2): WorldRenderSnapshot {
  return {
    cells,
    bounds: {
      minX: -300,
      maxX: 300,
      minY: -300,
      maxY: 300,
      centerX: 0,
      centerY: 0,
      width: 600,
      height: 600,
    },
    stage,
    fillLevel: 0,
    fillThreshold: 20,
    hexSize: 144,
    focusX: 0,
    focusY: 0,
    conquest: null,
  };
}

describe('backgroundMath', () => {
  it('prefers conquest then owned then living strategic cells for living anchors', () => {
    const conquestCell = createCell(1, 0, 'dead', { conquestState: 'active' });
    const ownedCell = createCell(0, 1, 'dead', { ownerId: 'player', conquestState: 'owned' });
    const purifiedCell = createCell(-1, 0, 'purified');
    const sample = selectLivingAnchors(
      createSnapshot([conquestCell, ownedCell, purifiedCell]),
    );

    expect(sample[0].source).toBe('conquest');
    expect(sample[0].cell?.coord).toEqual(conquestCell.coord);
    expect(sample[1].source).toBe('owned');
    expect(sample[1].cell?.coord).toEqual(ownedCell.coord);
    expect(sample[2].source).toBe('living');
    expect(sample[2].cell?.coord).toEqual(purifiedCell.coord);
  });

  it('falls back to the world center when there is no living world state yet', () => {
    const deadA = createCell(0, 0, 'dead');
    const deadB = createCell(1, -1, 'dead');
    const anchors = selectLivingAnchors(createSnapshot([deadA, deadB]));

    expect(anchors).toHaveLength(1);
    expect(anchors[0].source).toBe('fallback');
    expect(anchors[0].x).toBe(0);
    expect(anchors[0].y).toBe(0);
  });

  it('caps stage one corruption anchors and biases them away from living anchors', () => {
    const livingCell = createCell(0, 0, 'purified');
    const nearbyDead = createCell(0, 1, 'dead');
    const farDeadA = createCell(3, 0, 'dead');
    const farDeadB = createCell(-3, -1, 'dead');
    const farDeadC = createCell(2, 2, 'dead');
    const snapshot = createSnapshot(
      [livingCell, nearbyDead, farDeadA, farDeadB, farDeadC],
      1,
    );

    const corruptionAnchors = selectCorruptionAnchors(snapshot, selectLivingAnchors(snapshot));

    expect(getCorruptionAnchorCap(1)).toBe(2);
    expect(corruptionAnchors).toHaveLength(2);
    expect(corruptionAnchors.some((anchor) => anchor.cell?.coord.q === nearbyDead.coord.q && anchor.cell?.coord.r === nearbyDead.coord.r)).toBe(false);
  });

  it('returns the configured parallax offset for a layer', () => {
    expect(computeParallaxOffset(100, -50, 0.16)).toEqual({
      x: -16,
      y: 8,
    });
  });

  it('raises bio density near living anchors and corruption density near dead anchors', () => {
    const snapshot = createSnapshot([
      createCell(0, 0, 'purified'),
      createCell(3, 0, 'dead'),
      createCell(-3, 0, 'dead'),
    ]);
    const sample = createBackdropReactivitySample(snapshot);

    const nearLiving = sampleBackdropDensity({ x: 0, y: 0 }, sample, snapshot.hexSize);
    const nearDead = sampleBackdropDensity({ x: 360, y: 0 }, sample, snapshot.hexSize);

    expect(nearLiving.bio).toBeGreaterThan(nearDead.bio);
    expect(nearDead.corruption).toBeGreaterThan(nearLiving.corruption);
  });

  it('hides bio web samples that fall inside a hex tile (matches fill radius)', () => {
    const cell = createCell(0, 0, 'purified', { centerX: 0, centerY: 0 });
    const snapshot = createSnapshot([cell]);
    const r = getBackdropHexFillRadius(snapshot.hexSize);
    expect(r).toBeGreaterThan(10);

    expect(sampleBioWebHexOcclusion({ x: 0, y: 0 }, snapshot)).toBe(0);
    expect(sampleBioWebHexOcclusion({ x: 4000, y: -4000 }, snapshot)).toBe(1);
    expect(sampleBioWebHexOcclusion({ x: r * 0.35, y: 0 }, snapshot)).toBe(0);
  });
});
