import { describe, expect, it } from 'vitest';
import { HexGrid } from '@/entities/world/HexGrid';
import {
  applyExpansion,
  areHexCoordsAdjacent,
  canExpand,
  collectFrontierCoords,
  selectConnectedFrontierCluster,
} from '@/entities/world/WorldExpansion';

describe('WorldExpansion', () => {
  it('detects when the threshold has been met', () => {
    expect(canExpand(200, 200)).toBe(true);
    expect(canExpand(199.9, 200)).toBe(false);
  });

  it('adds three connected frontier cells and advances the threshold', () => {
    const grid = new HexGrid(100);
    const baseCells = grid.createDisk(1);
    const expanded = applyExpansion(
      grid,
      {
        stage: 1,
        fillLevel: 240,
        fillThreshold: 200,
        cells: baseCells,
      },
      100,
      () => 0,
    );
    const frontierKeys = new Set(
      collectFrontierCoords(grid, baseCells).map((coord) => `${coord.q},${coord.r}`),
    );

    expect(expanded.stage).toBe(2);
    expect(expanded.fillLevel).toBe(40);
    expect(expanded.fillThreshold).toBe(300);
    expect(expanded.event.newCells).toHaveLength(3);
    expect(expanded.cells).toHaveLength(baseCells.length + 3);
    const uniqueKeys = new Set(expanded.event.newCells.map((cell) => `${cell.coord.q},${cell.coord.r}`));
    expect(uniqueKeys.size).toBe(3);
    for (const cell of expanded.event.newCells) {
      expect(frontierKeys.has(`${cell.coord.q},${cell.coord.r}`)).toBe(true);
    }
    expect(
      expanded.event.newCells.every((cell, index) =>
        expanded.event.newCells.some((other, otherIndex) =>
          index !== otherIndex && areHexCoordsAdjacent(cell.coord, other.coord),
        ),
      ),
    ).toBe(true);
  });

  it('selects a connected frontier cluster of three unique cells', () => {
    const grid = new HexGrid(100);
    const baseCells = grid.createDisk(1);
    const frontierKeys = new Set(
      collectFrontierCoords(grid, baseCells).map((coord) => `${coord.q},${coord.r}`),
    );

    const cluster = selectConnectedFrontierCluster(grid, baseCells, 3, () => 0);

    expect(cluster).toHaveLength(3);
    expect(new Set(cluster.map((cell) => `${cell.coord.q},${cell.coord.r}`)).size).toBe(3);
    for (const cell of cluster) {
      expect(frontierKeys.has(`${cell.coord.q},${cell.coord.r}`)).toBe(true);
    }
    expect(
      cluster.every((cell, index) =>
        cluster.some(
          (other, otherIndex) =>
            index !== otherIndex && areHexCoordsAdjacent(cell.coord, other.coord),
        ),
      ),
    ).toBe(true);
  });

  it('can expand from a chosen frontier subset while still respecting the full occupied world', () => {
    const grid = new HexGrid(100);
    const tutorialCells = grid.createDisk(1);
    const remoteCells = grid.createDisk(1).map((cell) =>
      grid.createCell({ q: cell.coord.q + 5, r: cell.coord.r }),
    );
    const occupiedCells = [...tutorialCells, ...remoteCells];

    const expanded = applyExpansion(
      grid,
      {
        stage: 1,
        fillLevel: 240,
        fillThreshold: 200,
        cells: occupiedCells,
      },
      100,
      () => 0,
      remoteCells,
    );

    expect(
      expanded.event.newCells.every((cell) =>
        remoteCells.some((remote) => areHexCoordsAdjacent(cell.coord, remote.coord)),
      ),
    ).toBe(true);
    expect(
      expanded.event.newCells.some((cell) =>
        tutorialCells.some((tutorial) => areHexCoordsAdjacent(cell.coord, tutorial.coord)),
      ),
    ).toBe(false);
  });
});
