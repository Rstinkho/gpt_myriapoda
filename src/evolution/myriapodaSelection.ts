import type { EvolutionPartId } from '@/game/types';

export type EvolutionHitShape =
  | {
      kind: 'circle';
      x: number;
      y: number;
      radius: number;
    }
  | {
      kind: 'ellipse';
      x: number;
      y: number;
      radiusX: number;
      radiusY: number;
      rotation: number;
    }
  | {
      kind: 'capsule';
      ax: number;
      ay: number;
      bx: number;
      by: number;
      radius: number;
    };

export interface EvolutionSelectablePartRegion {
  id: EvolutionPartId;
  label: string;
  shape: EvolutionHitShape;
}

function getEvolutionPartPriority(partId: EvolutionPartId): number {
  if (partId === 'stomach') {
    return 0;
  }
  if (typeof partId !== 'string' && partId.type === 'segment') {
    return 2;
  }
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distanceToSegmentSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abX = bx - ax;
  const abY = by - ay;
  const abLengthSquared = abX * abX + abY * abY;

  if (abLengthSquared <= 0.0001) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }

  const t = clamp(((px - ax) * abX + (py - ay) * abY) / abLengthSquared, 0, 1);
  const cx = ax + abX * t;
  const cy = ay + abY * t;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

export function isSameEvolutionPartId(
  left: EvolutionPartId | null,
  right: EvolutionPartId | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  if (typeof left === 'string' || typeof right === 'string') {
    return left === right;
  }

  return left.type === right.type && left.index === right.index;
}

export function getEvolutionPartLabel(partId: EvolutionPartId): string {
  if (partId === 'head') {
    return 'Head';
  }
  if (partId === 'stomach') {
    return 'Stomach';
  }
  if (partId === 'tail') {
    return 'Tail';
  }
  if (partId.type === 'limb') {
    return `Limb ${partId.index + 1}`;
  }
  return `Body Circle ${partId.index + 1}`;
}

export function getHitShapeScore(
  shape: EvolutionHitShape,
  x: number,
  y: number,
): number | null {
  if (shape.kind === 'circle') {
    const dx = x - shape.x;
    const dy = y - shape.y;
    const distance = Math.hypot(dx, dy);
    return distance <= shape.radius ? distance / Math.max(1, shape.radius) : null;
  }

  if (shape.kind === 'ellipse') {
    const cos = Math.cos(-shape.rotation);
    const sin = Math.sin(-shape.rotation);
    const localX = (x - shape.x) * cos - (y - shape.y) * sin;
    const localY = (x - shape.x) * sin + (y - shape.y) * cos;
    const normalized =
      (localX * localX) / Math.max(1, shape.radiusX * shape.radiusX) +
      (localY * localY) / Math.max(1, shape.radiusY * shape.radiusY);
    return normalized <= 1 ? normalized : null;
  }

  const distanceSquared = distanceToSegmentSquared(
    x,
    y,
    shape.ax,
    shape.ay,
    shape.bx,
    shape.by,
  );
  const radiusSquared = shape.radius * shape.radius;
  return distanceSquared <= radiusSquared
    ? distanceSquared / Math.max(1, radiusSquared)
    : null;
}

export function findTopEvolutionPartAtPoint(
  regions: EvolutionSelectablePartRegion[],
  x: number,
  y: number,
): EvolutionSelectablePartRegion | null {
  let bestRegion: EvolutionSelectablePartRegion | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestSize = Number.POSITIVE_INFINITY;
  let bestPriority = Number.POSITIVE_INFINITY;

  for (const region of regions) {
    const score = getHitShapeScore(region.shape, x, y);
    if (score === null) {
      continue;
    }

    const priority = getEvolutionPartPriority(region.id);
    const size = getHitShapeSize(region.shape);
    if (priority > bestPriority) {
      continue;
    }
    if (priority < bestPriority) {
      bestRegion = region;
      bestScore = score;
      bestSize = size;
      bestPriority = priority;
      continue;
    }
    if (size > bestSize + 0.0001) {
      continue;
    }
    if (Math.abs(size - bestSize) <= 0.0001 && score > bestScore) {
      continue;
    }

    bestRegion = region;
    bestScore = score;
    bestSize = size;
    bestPriority = priority;
  }

  return bestRegion;
}

function getHitShapeSize(shape: EvolutionHitShape): number {
  if (shape.kind === 'circle') {
    return shape.radius;
  }
  if (shape.kind === 'ellipse') {
    return Math.max(shape.radiusX, shape.radiusY);
  }
  return shape.radius + Math.hypot(shape.bx - shape.ax, shape.by - shape.ay) * 0.18;
}
