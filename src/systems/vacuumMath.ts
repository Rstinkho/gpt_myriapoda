import { clamp, distance, normalizeAngle } from '@/utils/math';

export interface VacuumPullResult {
  shouldAbsorb: boolean;
  forceScale: number;
}

export function resolveVacuumPull(
  pickup: { x: number; y: number },
  head: { x: number; y: number },
  absorbRadius: number,
  coneLength: number,
): VacuumPullResult {
  const dist = distance(pickup, head);
  if (dist <= absorbRadius) {
    return {
      shouldAbsorb: true,
      forceScale: 0,
    };
  }

  return {
    shouldAbsorb: false,
    forceScale: clamp(1 - dist / coneLength, 0, 1),
  };
}

export function isInsideVacuumCone(
  pickup: { x: number; y: number },
  head: { x: number; y: number },
  headAngle: number,
  coneLength: number,
  coneHalfAngle: number,
): boolean {
  const dx = pickup.x - head.x;
  const dy = pickup.y - head.y;
  const distanceToPickup = Math.hypot(dx, dy);
  if (distanceToPickup > coneLength) {
    return false;
  }

  const angleToPickup = Math.atan2(dy, dx);
  return Math.abs(normalizeAngle(angleToPickup - headAngle)) <= coneHalfAngle;
}
