import { normalize } from '@/utils/math';

export interface StrikePoint {
  x: number;
  y: number;
}

export function getStrikeDirection(root: StrikePoint, tip: StrikePoint): StrikePoint {
  return normalize(tip.x - root.x, tip.y - root.y);
}

export function isPointInStrikeCone(
  origin: StrikePoint,
  direction: StrikePoint,
  point: StrikePoint,
  range: number,
  halfAngle: number,
): boolean {
  const toPoint = {
    x: point.x - origin.x,
    y: point.y - origin.y,
  };
  const distance = Math.hypot(toPoint.x, toPoint.y);
  if (distance > range || distance === 0) {
    return false;
  }

  const normalizedToPoint = {
    x: toPoint.x / distance,
    y: toPoint.y / distance,
  };
  const dot = direction.x * normalizedToPoint.x + direction.y * normalizedToPoint.y;
  return dot >= Math.cos(halfAngle);
}

export function isCircleInStrikeCone(
  origin: StrikePoint,
  direction: StrikePoint,
  center: StrikePoint,
  radius: number,
  range: number,
  halfAngle: number,
): boolean {
  const toCenter = {
    x: center.x - origin.x,
    y: center.y - origin.y,
  };
  const distance = Math.hypot(toCenter.x, toCenter.y);
  if (distance <= radius) {
    return true;
  }
  if (distance > range + radius || distance === 0) {
    return false;
  }

  const normalizedToCenter = {
    x: toCenter.x / distance,
    y: toCenter.y / distance,
  };
  const dot = direction.x * normalizedToCenter.x + direction.y * normalizedToCenter.y;
  const angularAllowance = Math.asin(Math.min(1, radius / distance));
  return dot >= Math.cos(halfAngle + angularAllowance);
}
