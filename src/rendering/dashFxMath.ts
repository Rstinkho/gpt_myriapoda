import { normalize } from '@/utils/math';

export interface DashPoint {
  x: number;
  y: number;
}

export interface DashRearAnchorOptions {
  baseOffsetPx: number;
  extraOffsetPx: number;
  motionStrength: number;
}

export function sampleDashRearAnchor(
  tailTip: DashPoint,
  direction: DashPoint,
  options: DashRearAnchorOptions,
): DashPoint {
  const normalizedDirection = normalize(direction.x, direction.y);
  const forward =
    normalizedDirection.x === 0 && normalizedDirection.y === 0
      ? { x: 1, y: 0 }
      : normalizedDirection;
  const offset =
    options.baseOffsetPx + options.extraOffsetPx * options.motionStrength;

  return {
    x: tailTip.x - forward.x * offset,
    y: tailTip.y - forward.y * offset,
  };
}
