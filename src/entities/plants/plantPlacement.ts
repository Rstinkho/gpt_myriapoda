import { tuning } from '@/game/tuning';
import type { HexCell } from '@/game/types';

export interface PlantAnchor {
  x: number;
  y: number;
}

export function resolvePlantAnchorInHex(
  cell: HexCell,
  angleRoll: number = Math.random(),
  radiusRoll: number = Math.random(),
): PlantAnchor {
  const angle = angleRoll * Math.PI * 2;
  const radialT = Math.sqrt(Math.max(0, Math.min(1, radiusRoll)));
  const offsetX =
    Math.cos(angle) * tuning.plantHexSpawnRadiusXPx * radialT;
  const offsetY =
    Math.sin(angle) * tuning.plantHexSpawnRadiusYPx * radialT;

  return {
    x: cell.centerX + offsetX,
    y: cell.centerY + tuning.plantRootOffsetYPx + offsetY,
  };
}
