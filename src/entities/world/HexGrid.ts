import type { HexCell, HexCoord } from '@/game/types';

export const axialDirections: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export class HexGrid {
  constructor(private readonly hexSize: number) {}

  axialToWorld(coord: HexCoord): { x: number; y: number } {
    return {
      x: this.hexSize * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r),
      y: this.hexSize * (1.5 * coord.r),
    };
  }

  createCell(coord: HexCoord): HexCell {
    const center = this.axialToWorld(coord);
    return {
      coord,
      centerX: center.x,
      centerY: center.y,
      unlocked: true,
      type: 'dead',
      buildable: false,
    };
  }

  neighbors(coord: HexCoord): HexCoord[] {
    return axialDirections.map((direction) => ({
      q: coord.q + direction.q,
      r: coord.r + direction.r,
    }));
  }

  createRing(radius: number): HexCoord[] {
    if (radius === 0) {
      return [{ q: 0, r: 0 }];
    }

    const coords: HexCoord[] = [];

    let cube = { q: -radius, r: radius };
    for (const direction of axialDirections) {
      for (let step = 0; step < radius; step += 1) {
        coords.push({ q: cube.q, r: cube.r });
        cube = { q: cube.q + direction.q, r: cube.r + direction.r };
      }
    }

    return coords;
  }

  createDisk(radius: number): HexCell[] {
    const cells: HexCell[] = [];
    for (let q = -radius; q <= radius; q += 1) {
      const rMin = Math.max(-radius, -q - radius);
      const rMax = Math.min(radius, -q + radius);
      for (let r = rMin; r <= rMax; r += 1) {
        cells.push(this.createCell({ q, r }));
      }
    }
    return cells;
  }
}
