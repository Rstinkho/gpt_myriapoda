import { describe, expect, it } from 'vitest';
import { HexWorld } from '@/entities/world/HexWorld';
import { createCoordKey } from '@/entities/world/WorldExpansion';

function getPurifiedCellKeys(world: HexWorld): string[] {
  return world.cells
    .filter((cell) => cell.type === 'purified')
    .map((cell) => createCoordKey(cell.coord));
}

describe('HexWorld', () => {
  it('starts with exactly one purified hex', () => {
    const world = new HexWorld(() => 0);

    expect(world.stage).toBe(1);
    expect(getPurifiedCellKeys(world)).toHaveLength(1);
  });

  it('adds exactly one new purified hex per expansion and preserves existing purified hexes', () => {
    const world = new HexWorld(() => 0);
    const initialPurified = getPurifiedCellKeys(world);

    const firstExpansion = world.addFill(world.fillThreshold);
    expect(firstExpansion).not.toBeNull();
    expect(firstExpansion!.newCells.filter((cell) => cell.type === 'purified')).toHaveLength(1);
    const afterFirstExpansion = getPurifiedCellKeys(world);
    expect(afterFirstExpansion).toHaveLength(2);
    expect(afterFirstExpansion).toEqual(expect.arrayContaining(initialPurified));

    const secondExpansion = world.addFill(world.fillThreshold);
    expect(secondExpansion).not.toBeNull();
    expect(secondExpansion!.newCells.filter((cell) => cell.type === 'purified')).toHaveLength(1);
    const afterSecondExpansion = getPurifiedCellKeys(world);
    expect(afterSecondExpansion).toHaveLength(3);
    expect(afterSecondExpansion).toEqual(expect.arrayContaining(afterFirstExpansion));
    expect(world.stage).toBe(3);
  });
});
