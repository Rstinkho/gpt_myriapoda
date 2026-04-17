import type { HexCell, HexCoord } from '@/game/types';

export interface BorderPoint {
  x: number;
  y: number;
}

export interface BorderEdge {
  start: BorderPoint;
  end: BorderPoint;
}

/** Axial directions to neighbors (order matches `createRegularHexPoints` side indices). */
export const HEX_NEIGHBOR_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/**
 * Computes the 6 vertices of a regular hex, pointy-top orientation (first vertex at -90°).
 *
 * Accepts an optional `out` array to mutate in place — crucial for per-frame hot paths
 * (every tile fill/stroke in the world renderer calls this) where fresh allocations
 * create significant GC pressure. When `out` is provided, the same 6 objects inside it
 * are updated and returned; when omitted, a fresh 6-element array is allocated.
 */
export function createRegularHexPoints(
  centerX: number,
  centerY: number,
  radius: number,
  out?: BorderPoint[],
): BorderPoint[] {
  const points = out ?? new Array<BorderPoint>(6);
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index - 30);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const existing = points[index];
    if (existing) {
      existing.x = x;
      existing.y = y;
    } else {
      points[index] = { x, y };
    }
  }
  return points;
}

function createCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function getMidpoint(edge: BorderEdge): BorderPoint {
  return {
    x: (edge.start.x + edge.end.x) * 0.5,
    y: (edge.start.y + edge.end.y) * 0.5,
  };
}

function getDistanceSquared(left: BorderPoint, right: BorderPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function flipEdge(edge: BorderEdge): BorderEdge {
  return {
    start: edge.end,
    end: edge.start,
  };
}

function normalizeAngleFromTopClockwise(angle: number): number {
  let normalized = angle + Math.PI / 2;
  while (normalized < 0) {
    normalized += Math.PI * 2;
  }
  while (normalized >= Math.PI * 2) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

function orientEdgesIntoChain(edges: BorderEdge[]): BorderEdge[] {
  if (edges.length <= 1) {
    return edges.map((edge) => ({ ...edge }));
  }

  const oriented: BorderEdge[] = [];
  const first = { ...edges[0] };
  const second = edges[1];
  const keepFirstDistance = Math.min(
    getDistanceSquared(first.end, second.start),
    getDistanceSquared(first.end, second.end),
  );
  const flipFirstDistance = Math.min(
    getDistanceSquared(first.start, second.start),
    getDistanceSquared(first.start, second.end),
  );
  oriented.push(keepFirstDistance <= flipFirstDistance ? first : flipEdge(first));

  for (let index = 1; index < edges.length; index += 1) {
    const candidate = { ...edges[index] };
    const previousEnd = oriented[index - 1].end;
    oriented.push(
      getDistanceSquared(previousEnd, candidate.start) <= getDistanceSquared(previousEnd, candidate.end)
        ? candidate
        : flipEdge(candidate),
    );
  }

  return oriented;
}

export function createExposedHexEdges(cells: HexCell[], cellRadius: number): BorderEdge[] {
  if (cells.length === 0) {
    return [];
  }

  const cellKeys = new Set(cells.map((cell) => createCoordKey(cell.coord)));
  const edges: BorderEdge[] = [];

  for (const cell of cells) {
    const points = createRegularHexPoints(cell.centerX, cell.centerY, cellRadius);
    for (let side = 0; side < HEX_NEIGHBOR_DIRECTIONS.length; side += 1) {
      const direction = HEX_NEIGHBOR_DIRECTIONS[side];
      const neighborKey = createCoordKey({
        q: cell.coord.q + direction.q,
        r: cell.coord.r + direction.r,
      });
      if (cellKeys.has(neighborKey)) {
        continue;
      }

      edges.push({
        start: points[side],
        end: points[(side + 1) % points.length],
      });
    }
  }

  return edges;
}

export function orderBorderEdgesClockwise(edges: BorderEdge[]): BorderEdge[] {
  if (edges.length <= 1) {
    return edges.map((edge) => ({ ...edge }));
  }

  const centroid = edges.reduce(
    (accumulator, edge) => {
      const midpoint = getMidpoint(edge);
      return {
        x: accumulator.x + midpoint.x / edges.length,
        y: accumulator.y + midpoint.y / edges.length,
      };
    },
    { x: 0, y: 0 },
  );

  const sorted = [...edges].sort((left, right) => {
    const leftMidpoint = getMidpoint(left);
    const rightMidpoint = getMidpoint(right);
    const leftAngle = normalizeAngleFromTopClockwise(
      Math.atan2(leftMidpoint.y - centroid.y, leftMidpoint.x - centroid.x),
    );
    const rightAngle = normalizeAngleFromTopClockwise(
      Math.atan2(rightMidpoint.y - centroid.y, rightMidpoint.x - centroid.x),
    );
    return leftAngle - rightAngle;
  });

  return orientEdgesIntoChain(sorted);
}

export function getBorderLength(edges: BorderEdge[]): number {
  return edges.reduce((length, edge) => {
    return length + Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
  }, 0);
}

function pointAlongEdge(edge: BorderEdge, t: number): BorderPoint {
  return {
    x: edge.start.x + (edge.end.x - edge.start.x) * t,
    y: edge.start.y + (edge.end.y - edge.start.y) * t,
  };
}

export function createDashedLineSegments(
  start: BorderPoint,
  end: BorderPoint,
  dashLength: number,
  gapLength: number,
  offset = 0,
): BorderEdge[] {
  const totalLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (totalLength <= 0 || dashLength <= 0) {
    return [];
  }

  const edge: BorderEdge = { start, end };
  const cycle = Math.max(0.0001, dashLength + Math.max(0, gapLength));
  const normalizedOffset = ((offset % cycle) + cycle) % cycle;
  const segments: BorderEdge[] = [];
  let cursor = -normalizedOffset;

  while (cursor < totalLength) {
    const dashStart = Math.max(0, cursor);
    const dashEnd = Math.min(totalLength, cursor + dashLength);
    if (dashEnd > dashStart) {
      segments.push({
        start: pointAlongEdge(edge, dashStart / totalLength),
        end: pointAlongEdge(edge, dashEnd / totalLength),
      });
    }
    cursor += cycle;
  }

  return segments;
}

export function createProgressBorderSlice(
  edges: BorderEdge[],
  startProgress: number,
  endProgress: number,
): BorderEdge[] {
  if (edges.length === 0) {
    return [];
  }

  const orderedEdges = orderBorderEdgesClockwise(edges);
  return createProgressBorderSliceFromOrdered(orderedEdges, startProgress, endProgress);
}

/**
 * Same as `createProgressBorderSlice` but takes pre-ordered edges. Intended for hot render
 * paths where the same ordered chain is reused for multiple slices (rail / trail / front)
 * in the same frame — skips a redundant `orderBorderEdgesClockwise` (sort + O(N) chain walk).
 */
export function createProgressBorderSliceFromOrdered(
  orderedEdges: BorderEdge[],
  startProgress: number,
  endProgress: number,
): BorderEdge[] {
  if (orderedEdges.length === 0) {
    return [];
  }

  const totalLength = getBorderLength(orderedEdges);
  if (totalLength <= 0) {
    return [];
  }

  const clampedStart = Math.max(0, Math.min(1, Math.min(startProgress, endProgress)));
  const clampedEnd = Math.max(0, Math.min(1, Math.max(startProgress, endProgress)));
  if (clampedEnd <= clampedStart) {
    return [];
  }

  if (clampedStart === 0 && clampedEnd === 1) {
    return orderedEdges;
  }

  const startLength = totalLength * clampedStart;
  const endLength = totalLength * clampedEnd;
  const sliceEdges: BorderEdge[] = [];
  let traversedLength = 0;

  for (const edge of orderedEdges) {
    const edgeLength = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
    const edgeStart = traversedLength;
    const edgeEnd = traversedLength + edgeLength;
    const overlapStart = Math.max(startLength, edgeStart);
    const overlapEnd = Math.min(endLength, edgeEnd);

    if (overlapEnd > overlapStart && edgeLength > 0) {
      const startT = (overlapStart - edgeStart) / edgeLength;
      const endT = (overlapEnd - edgeStart) / edgeLength;
      sliceEdges.push({
        start: pointAlongEdge(edge, startT),
        end: pointAlongEdge(edge, endT),
      });
    }

    traversedLength = edgeEnd;
    if (traversedLength >= endLength) {
      break;
    }
  }

  return sliceEdges;
}

export function createProgressBorderEdges(edges: BorderEdge[], progress: number): BorderEdge[] {
  return createProgressBorderSlice(edges, 0, progress);
}

export function createProgressBorderEdgesFromOrdered(
  orderedEdges: BorderEdge[],
  progress: number,
): BorderEdge[] {
  return createProgressBorderSliceFromOrdered(orderedEdges, 0, progress);
}
