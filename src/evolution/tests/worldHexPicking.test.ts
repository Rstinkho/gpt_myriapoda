import { describe, expect, it } from 'vitest';
import { HexGrid } from '@/entities/world/HexGrid';
import {
  findHexCellAtWorldPoint,
  pointToHexCoord,
  viewportToWorldPoint,
  worldToViewportPoint,
} from '@/evolution/worldHexPicking';

describe('worldHexPicking', () => {
  it('rounds world coordinates back to the matching axial coord', () => {
    const grid = new HexGrid(144);
    const coord = { q: 2, r: -1 };
    const center = grid.axialToWorld(coord);

    expect(pointToHexCoord(center.x, center.y, 144)).toEqual(coord);
  });

  it('finds the hovered cell from a world point near the cell center', () => {
    const grid = new HexGrid(144);
    const cells = [
      grid.createCell({ q: 0, r: 0 }),
      grid.createCell({ q: 1, r: 0 }),
      grid.createCell({ q: 0, r: 1 }),
    ];
    const center = grid.axialToWorld({ q: 1, r: 0 });

    expect(
      findHexCellAtWorldPoint(cells, 144, center.x + 18, center.y - 14)?.coord,
    ).toEqual({ q: 1, r: 0 });
  });

  it('converts viewport points to world and back with the same camera transform', () => {
    const viewport = { x: 80, y: 120, width: 960, height: 640 };
    const camera = { centerX: 240, centerY: -120, zoom: 0.42 };
    const screen = { x: 400, y: 300 };

    const world = viewportToWorldPoint(screen.x, screen.y, viewport, camera);
    expect(worldToViewportPoint(world.x, world.y, viewport, camera)).toEqual(screen);
  });
});
