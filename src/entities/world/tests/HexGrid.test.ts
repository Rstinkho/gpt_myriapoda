import { describe, expect, it } from 'vitest';
import { HexGrid } from '@/entities/world/HexGrid';

describe('HexGrid', () => {
  it('creates a six-cell ring for radius 1', () => {
    const grid = new HexGrid(100);
    expect(grid.createRing(1)).toHaveLength(6);
  });

  it('creates the expected disk cell count', () => {
    const grid = new HexGrid(100);
    expect(grid.createDisk(2)).toHaveLength(19);
  });
});
