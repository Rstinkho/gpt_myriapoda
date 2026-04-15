import type { HexCell } from '@/game/types';
import { randomBetween, randomItem } from '@/utils/random';

export interface SpawnPoint {
  x: number;
  y: number;
  cell: HexCell;
}

export function enforceEnemyCap(currentCount: number, cap: number): number {
  return Math.max(0, cap - currentCount);
}

export class SpawnSystem {
  constructor(private readonly padding: number) {}

  pickSpawn(cells: HexCell[], excludedCenter?: { x: number; y: number }): SpawnPoint {
    const cell = randomItem(cells);
    return this.pickSpawnInCell(cell, excludedCenter);
  }

  pickSpawnInCell(cell: HexCell, excludedCenter?: { x: number; y: number }): SpawnPoint {
    const angle = randomBetween(0, Math.PI * 2);
    const radius = randomBetween(12, this.padding);
    const x = cell.centerX + Math.cos(angle) * radius;
    const y = cell.centerY + Math.sin(angle) * radius;

    if (
      excludedCenter &&
      Math.hypot(x - excludedCenter.x, y - excludedCenter.y) < this.padding * 0.75
    ) {
      return this.pickSpawnInCell(cell, excludedCenter);
    }

    return { x, y, cell };
  }
}
