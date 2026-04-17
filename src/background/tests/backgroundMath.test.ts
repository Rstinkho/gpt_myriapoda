import { describe, expect, it } from 'vitest';
import {
  computeParallaxOffset,
  createBackdropReactivitySample,
  getCorruptionAnchorCap,
  getBackdropHexFillRadius,
  pickPulseEndpoints,
  samplePulsePosition,
  sampleBackdropDensity,
  sampleBioWebHexOcclusion,
  selectCorruptionAnchors,
  selectLivingAnchors,
  type BackdropReactivitySample,
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
    generation: 1,
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

  describe('pickPulseEndpoints', () => {
    it('prefers conquest start, picks a different anchor as end', () => {
      const snapshot = createSnapshot([
        createCell(2, 0, 'dead', { conquestState: 'active' }),
        createCell(0, 1, 'dead', { ownerId: 'player', conquestState: 'owned' }),
        createCell(-1, 0, 'purified'),
      ]);
      const sample = createBackdropReactivitySample(snapshot);
      const endpoints = pickPulseEndpoints(sample, { fallbackSpan: 100 });

      expect(endpoints).not.toBeNull();
      const conquestAnchor = sample.livingAnchors.find((a) => a.source === 'conquest')!;
      expect(endpoints!.fromX).toBe(conquestAnchor.x);
      expect(endpoints!.fromY).toBe(conquestAnchor.y);
      expect({ x: endpoints!.toX, y: endpoints!.toY }).not.toEqual({
        x: conquestAnchor.x,
        y: conquestAnchor.y,
      });
    });

    it('uses fallback offset when only one living anchor is available', () => {
      const snapshot = createSnapshot([createCell(0, 0, 'purified')]);
      const sample = createBackdropReactivitySample(snapshot);
      const endpoints = pickPulseEndpoints(sample, {
        randomUnit: () => 0,
        fallbackSpan: 80,
      });

      expect(endpoints).not.toBeNull();
      expect(endpoints!.fromX).toBe(0);
      expect(endpoints!.fromY).toBe(0);
      expect(Math.hypot(endpoints!.toX, endpoints!.toY)).toBeCloseTo(80, 6);
    });

    it('returns null when no living anchors exist', () => {
      const empty: BackdropReactivitySample = {
        livingAnchors: [],
        corruptionAnchors: [],
        primaryLivingAnchor: undefined as never,
      };
      expect(pickPulseEndpoints(empty, { fallbackSpan: 100 })).toBeNull();
    });
  });

  describe('samplePulsePosition', () => {
    const endpoints = {
      fromX: 0,
      fromY: 0,
      toX: 100,
      toY: 0,
      sourceWeight: 1,
    };

    it('returns the path endpoints at t=0 and t=1 regardless of bow amplitude', () => {
      const start = samplePulsePosition(endpoints, 0, 30);
      const end = samplePulsePosition(endpoints, 1, 30);
      expect(start.x).toBeCloseTo(0, 9);
      expect(start.y).toBeCloseTo(0, 9);
      expect(end.x).toBeCloseTo(100, 9);
      expect(end.y).toBeCloseTo(0, 9);
    });

    it('clamps t outside the unit interval back to endpoints', () => {
      expect(samplePulsePosition(endpoints, -0.5)).toEqual({ x: 0, y: 0 });
      expect(samplePulsePosition(endpoints, 2)).toEqual({ x: 100, y: 0 });
    });

    it('produces a curved path with bow amplitude at midpoint', () => {
      const midStraight = samplePulsePosition(endpoints, 0.5, 0);
      const midBowed = samplePulsePosition(endpoints, 0.5, 20);
      expect(midStraight).toEqual({ x: 50, y: 0 });
      expect(midBowed.x).toBeCloseTo(50, 6);
      expect(Math.abs(midBowed.y)).toBeCloseTo(20, 6);
    });

    it('degenerate (zero-length) paths still return the start point', () => {
      const degenerate = { fromX: 5, fromY: 7, toX: 5, toY: 7, sourceWeight: 1 };
      expect(samplePulsePosition(degenerate, 0.5, 15)).toEqual({ x: 5, y: 7 });
    });
  });
});
