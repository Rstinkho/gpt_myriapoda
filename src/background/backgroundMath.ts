import { tuning } from '@/game/tuning';
import type { HexCell, WorldRenderSnapshot } from '@/game/types';
import { createRegularHexPoints, type BorderPoint } from '@/rendering/worldBorderMath';

export type BackdropAnchorSource =
  | 'conquest'
  | 'owned'
  | 'living'
  | 'fallback'
  | 'dead';

export interface BackdropAnchor {
  x: number;
  y: number;
  weight: number;
  source: BackdropAnchorSource;
  cell?: HexCell;
}

export interface BackdropReactivitySample {
  livingAnchors: BackdropAnchor[];
  corruptionAnchors: BackdropAnchor[];
  primaryLivingAnchor: BackdropAnchor;
}

function coordKey(cell: HexCell): string {
  return `${cell.coord.q},${cell.coord.r}`;
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function createAnchor(
  cell: HexCell,
  source: BackdropAnchorSource,
  weight: number,
): BackdropAnchor {
  return {
    x: cell.centerX,
    y: cell.centerY,
    weight,
    source,
    cell,
  };
}

export function computeParallaxOffset(
  scrollX: number,
  scrollY: number,
  multiplier: number,
): { x: number; y: number } {
  return {
    x: -scrollX * multiplier,
    y: -scrollY * multiplier,
  };
}

export function getCorruptionAnchorCap(stage: number): number {
  if (stage <= 1) {
    return tuning.background.reactivity.stageOneCorruptionAnchors;
  }

  return Math.min(
    tuning.background.reactivity.maxCorruptionAnchors,
    tuning.background.reactivity.stageOneCorruptionAnchors + Math.max(1, stage - 1),
  );
}

export function selectLivingAnchors(snapshot: WorldRenderSnapshot): BackdropAnchor[] {
  const anchors: BackdropAnchor[] = [];
  const seenKeys = new Set<string>();
  const conquestCell =
    snapshot.cells.find((cell) => cell.conquestState === 'active') ?? null;
  const ownedCell =
    snapshot.cells.find(
      (cell) => cell.ownerId === 'player' || cell.conquestState === 'owned',
    ) ?? null;

  if (conquestCell) {
    anchors.push(createAnchor(conquestCell, 'conquest', 1.2));
    seenKeys.add(coordKey(conquestCell));
  }

  if (ownedCell && !seenKeys.has(coordKey(ownedCell))) {
    anchors.push(createAnchor(ownedCell, 'owned', 1));
    seenKeys.add(coordKey(ownedCell));
  }

  const strategicCells = snapshot.cells
    .filter((cell) => cell.type === 'purified' || cell.type === 'enriched')
    .filter((cell) => !seenKeys.has(coordKey(cell)))
    .slice(0, tuning.background.reactivity.maxStrategicLivingAnchors);

  for (const cell of strategicCells) {
    anchors.push(createAnchor(cell, 'living', cell.type === 'enriched' ? 0.9 : 0.82));
    seenKeys.add(coordKey(cell));
  }

  if (anchors.length === 0) {
    anchors.push({
      x: snapshot.bounds.centerX,
      y: snapshot.bounds.centerY,
      weight: 0.55,
      source: 'fallback',
    });
  }

  return anchors;
}

export function selectCorruptionAnchors(
  snapshot: WorldRenderSnapshot,
  livingAnchors: BackdropAnchor[] = selectLivingAnchors(snapshot),
): BackdropAnchor[] {
  const deadCells = snapshot.cells.filter((cell) => cell.type === 'dead');
  if (deadCells.length === 0) {
    return [];
  }

  const boundsRadius = Math.max(
    snapshot.bounds.width,
    snapshot.bounds.height,
    snapshot.hexSize * 2,
  ) * 0.5;
  const center = {
    x: snapshot.bounds.centerX,
    y: snapshot.bounds.centerY,
  };

  return [...deadCells]
    .sort((left, right) => {
      const leftLivingDistance = Math.min(
        ...livingAnchors.map((anchor) =>
          distanceBetween(anchor, {
            x: left.centerX,
            y: left.centerY,
          }),
        ),
      );
      const rightLivingDistance = Math.min(
        ...livingAnchors.map((anchor) =>
          distanceBetween(anchor, {
            x: right.centerX,
            y: right.centerY,
          }),
        ),
      );
      const leftPerimeterScore = clamp(
        distanceBetween(center, { x: left.centerX, y: left.centerY }) / boundsRadius,
      );
      const rightPerimeterScore = clamp(
        distanceBetween(center, { x: right.centerX, y: right.centerY }) / boundsRadius,
      );
      const leftScore =
        clamp(leftLivingDistance / Math.max(snapshot.hexSize, boundsRadius)) * 0.58 +
        leftPerimeterScore * 0.42;
      const rightScore =
        clamp(rightLivingDistance / Math.max(snapshot.hexSize, boundsRadius)) * 0.58 +
        rightPerimeterScore * 0.42;
      return rightScore - leftScore;
    })
    .slice(0, getCorruptionAnchorCap(snapshot.stage))
    .map((cell, index) =>
      createAnchor(cell, 'dead', 0.72 - index * 0.06),
    );
}

export function createBackdropReactivitySample(
  snapshot: WorldRenderSnapshot,
): BackdropReactivitySample {
  const livingAnchors = selectLivingAnchors(snapshot);
  const corruptionAnchors = selectCorruptionAnchors(snapshot, livingAnchors);

  return {
    livingAnchors,
    corruptionAnchors,
    primaryLivingAnchor: livingAnchors[0],
  };
}

export function getWeightedAnchorCenter(anchors: BackdropAnchor[]): { x: number; y: number } {
  if (anchors.length === 0) {
    return { x: 0, y: 0 };
  }

  const totalWeight = anchors.reduce((sum, anchor) => sum + anchor.weight, 0);
  if (totalWeight <= 0.0001) {
    return { x: anchors[0].x, y: anchors[0].y };
  }

  return anchors.reduce(
    (center, anchor) => ({
      x: center.x + (anchor.x * anchor.weight) / totalWeight,
      y: center.y + (anchor.y * anchor.weight) / totalWeight,
    }),
    { x: 0, y: 0 },
  );
}

function pointInConvexPolygon(px: number, py: number, points: BorderPoint[]): boolean {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const crossesHorizontal = (yi > py) !== (yj > py);
    if (!crossesHorizontal) {
      continue;
    }
    const xIntersect = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (px < xIntersect) {
      inside = !inside;
    }
  }
  return inside;
}

/** Matches `WorldRenderer` hex fill radius (no animation scale). */
export function getBackdropHexFillRadius(hexSize: number): number {
  return Math.max(4, hexSize - tuning.worldCellInset);
}

/**
 * 1 = web may show; 0 = sample lies inside a world hex interior (matches tile fill shape).
 */
export function sampleBioWebHexOcclusion(
  point: { x: number; y: number },
  snapshot: WorldRenderSnapshot,
): number {
  const r = getBackdropHexFillRadius(snapshot.hexSize);
  for (const cell of snapshot.cells) {
    const dx = point.x - cell.centerX;
    const dy = point.y - cell.centerY;
    if (dx * dx + dy * dy > r * r * 1.0001) {
      continue;
    }
    const poly = createRegularHexPoints(cell.centerX, cell.centerY, r);
    if (pointInConvexPolygon(point.x, point.y, poly)) {
      return 0;
    }
  }
  return 1;
}

/**
 * Occlusion for a web sprite centered at `drawCenter` with axis-aligned extent (ignores rotation;
 * slightly conservative so filigree does not sit on hex interiors).
 */
export function sampleBioWebHexOcclusionRect(
  drawCenter: { x: number; y: number },
  halfWidth: number,
  halfHeight: number,
  snapshot: WorldRenderSnapshot,
): number {
  const hx = Math.max(0, halfWidth * 0.42);
  const hy = Math.max(0, halfHeight * 0.42);
  const samples = [
    drawCenter,
    { x: drawCenter.x + hx, y: drawCenter.y + hy },
    { x: drawCenter.x - hx, y: drawCenter.y + hy },
    { x: drawCenter.x + hx, y: drawCenter.y - hy },
    { x: drawCenter.x - hx, y: drawCenter.y - hy },
  ];
  let minOcc = 1;
  for (const p of samples) {
    minOcc = Math.min(minOcc, sampleBioWebHexOcclusion(p, snapshot));
    if (minOcc <= 0) {
      return 0;
    }
  }
  return minOcc;
}

export interface PulseEndpoints {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  sourceWeight: number;
}

function anchorPriorityScore(anchor: BackdropAnchor): number {
  switch (anchor.source) {
    case 'conquest':
      return 3 + anchor.weight;
    case 'owned':
      return 2 + anchor.weight;
    case 'living':
      return 1 + anchor.weight;
    case 'fallback':
      return 0.25 + anchor.weight;
    case 'dead':
      return anchor.weight * 0.5;
    default:
      return anchor.weight;
  }
}

/**
 * Picks a start anchor (conquest > owned > living > fallback) and a distinct end anchor for a
 * bio-electric pulse travelling between living anchors. When only one anchor is available the
 * pulse arcs toward a short offset so it still reads as a traveling spark.
 */
export function pickPulseEndpoints(
  sample: BackdropReactivitySample,
  options: {
    randomUnit?: () => number;
    fallbackSpan?: number;
  } = {},
): PulseEndpoints | null {
  const random = options.randomUnit ?? Math.random;
  const fallbackSpan = Math.max(0, options.fallbackSpan ?? 0);
  const anchors = sample.livingAnchors;
  if (anchors.length === 0) {
    return null;
  }

  const sortedBySource = [...anchors].sort(
    (left, right) => anchorPriorityScore(right) - anchorPriorityScore(left),
  );
  const start = sortedBySource[0]!;

  let end: BackdropAnchor | null = null;
  if (sortedBySource.length >= 2) {
    const candidates = sortedBySource.slice(1);
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const separation = distanceBetween(start, candidate);
      const score = separation * 0.001 + anchorPriorityScore(candidate);
      if (score > bestScore) {
        bestScore = score;
        end = candidate;
      }
    }
  }

  if (!end) {
    if (fallbackSpan <= 0) {
      return null;
    }
    const angle = random() * Math.PI * 2;
    return {
      fromX: start.x,
      fromY: start.y,
      toX: start.x + Math.cos(angle) * fallbackSpan,
      toY: start.y + Math.sin(angle) * fallbackSpan,
      sourceWeight: start.weight,
    };
  }

  return {
    fromX: start.x,
    fromY: start.y,
    toX: end.x,
    toY: end.y,
    sourceWeight: start.weight,
  };
}

/**
 * Returns a point on the pulse path at progress `t` (0..1). A small sinusoidal bow is applied
 * perpendicular to the travel axis so pulses read as curving along vein paths rather than
 * straight-line lasers. Endpoints are preserved exactly at t=0 and t=1.
 */
export function samplePulsePosition(
  endpoints: PulseEndpoints,
  t: number,
  bowAmplitudePx = 0,
): { x: number; y: number } {
  const clamped = clamp(t, 0, 1);
  const baseX = endpoints.fromX + (endpoints.toX - endpoints.fromX) * clamped;
  const baseY = endpoints.fromY + (endpoints.toY - endpoints.fromY) * clamped;
  if (bowAmplitudePx === 0) {
    return { x: baseX, y: baseY };
  }

  const dx = endpoints.toX - endpoints.fromX;
  const dy = endpoints.toY - endpoints.fromY;
  const length = Math.hypot(dx, dy);
  if (length < 0.0001) {
    return { x: baseX, y: baseY };
  }
  const nx = -dy / length;
  const ny = dx / length;
  const bow = Math.sin(clamped * Math.PI) * bowAmplitudePx;
  return {
    x: baseX + nx * bow,
    y: baseY + ny * bow,
  };
}

export function sampleBackdropDensity(
  point: { x: number; y: number },
  sample: BackdropReactivitySample,
  hexSize: number,
): { bio: number; corruption: number; localPulse: number } {
  const livingRadius =
    hexSize * tuning.background.reactivity.livingInfluenceRadiusMultiplier;
  const corruptionRadius =
    hexSize * tuning.background.reactivity.corruptionInfluenceRadiusMultiplier;

  const bio = sample.livingAnchors.reduce((maxInfluence, anchor) => {
    const distance = distanceBetween(point, anchor);
    const influence =
      clamp(1 - distance / Math.max(hexSize, livingRadius)) * anchor.weight;
    return Math.max(maxInfluence, influence);
  }, 0);
  const corruption = sample.corruptionAnchors.reduce((maxInfluence, anchor) => {
    const distance = distanceBetween(point, anchor);
    const influence =
      clamp(1 - distance / Math.max(hexSize, corruptionRadius)) * anchor.weight;
    return Math.max(maxInfluence, influence);
  }, 0);
  const localPulse = sample.livingAnchors.some((anchor) => anchor.source === 'conquest')
    ? clamp(bio * tuning.background.reactivity.conquestPulseBoost * 2.4)
    : 0;

  return {
    bio: clamp(bio),
    corruption: clamp(corruption),
    localPulse: clamp(localPulse),
  };
}
