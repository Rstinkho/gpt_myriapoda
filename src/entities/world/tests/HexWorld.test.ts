import { describe, expect, it } from 'vitest';
import { HexWorld } from '@/entities/world/HexWorld';
import { createCoordKey } from '@/entities/world/WorldExpansion';

function getPurifiedCellKeys(world: HexWorld): string[] {
  return world.cells
    .filter((cell) => cell.type === 'purified')
    .map((cell) => createCoordKey(cell.coord));
}

function getEnrichedCellKeys(world: HexWorld): string[] {
  return world.cells
    .filter((cell) => cell.type === 'enriched')
    .map((cell) => createCoordKey(cell.coord));
}

describe('HexWorld', () => {
  it('starts with exactly one purified hex and no enriched hexes', () => {
    const world = new HexWorld(() => 0);

    expect(world.stage).toBe(1);
    expect(getPurifiedCellKeys(world)).toHaveLength(1);
    expect(getEnrichedCellKeys(world)).toHaveLength(0);
  });

  it('adds purified hexes every expansion and enriched hexes once stage 3 begins', () => {
    const world = new HexWorld(() => 0);
    const initialPurified = getPurifiedCellKeys(world);

    const firstExpansion = world.addFill(world.fillThreshold);
    expect(firstExpansion).not.toBeNull();
    expect(firstExpansion!.newCells.filter((cell) => cell.type === 'purified')).toHaveLength(1);
    expect(firstExpansion!.newCells.filter((cell) => cell.type === 'enriched')).toHaveLength(0);
    const afterFirstExpansion = getPurifiedCellKeys(world);
    expect(afterFirstExpansion).toHaveLength(2);
    expect(getEnrichedCellKeys(world)).toHaveLength(0);
    expect(afterFirstExpansion).toEqual(expect.arrayContaining(initialPurified));

    const secondExpansion = world.addFill(world.fillThreshold);
    expect(secondExpansion).not.toBeNull();
    expect(secondExpansion!.newCells.filter((cell) => cell.type === 'purified')).toHaveLength(1);
    expect(secondExpansion!.newCells.filter((cell) => cell.type === 'enriched')).toHaveLength(1);
    const afterSecondExpansion = getPurifiedCellKeys(world);
    const afterSecondEnriched = getEnrichedCellKeys(world);
    expect(afterSecondExpansion).toHaveLength(3);
    expect(afterSecondEnriched).toHaveLength(1);
    expect(afterSecondExpansion).toEqual(expect.arrayContaining(afterFirstExpansion));
    expect(world.stage).toBe(3);
  });

  it('tracks a single active conquest and marks the completed hex as owned and buildable', () => {
    const world = new HexWorld(() => 0);
    const deadCell = world.cells.find((cell) => cell.type === 'dead');

    expect(deadCell).toBeDefined();
    expect(world.canConquerCell(deadCell!.coord)).toBe(true);

    const active = world.beginConquest(deadCell!.coord);
    expect(active?.conquestState).toBe('active');
    expect(world.canConquerCell(deadCell!.coord)).toBe(false);

    const completed = world.completeConquest(deadCell!.coord);
    expect(completed?.conquestState).toBe('owned');
    expect(completed?.ownerId).toBe('player');
    expect(completed?.buildable).toBe(true);
    expect(world.hasOwnedCell()).toBe(true);
  });

  it('allows conquering additional dead hexes after the first one is owned', () => {
    const world = new HexWorld(() => 0);
    const deadCells = world.cells.filter((cell) => cell.type === 'dead');

    expect(deadCells).toHaveLength(6);
    expect(world.completeConquest(deadCells[0]!.coord)?.conquestState).toBe('owned');
    expect(world.canConquerCell(deadCells[1]!.coord)).toBe(true);
    expect(world.beginConquest(deadCells[1]!.coord)?.conquestState).toBe('active');
    expect(world.completeConquest(deadCells[1]!.coord)?.conquestState).toBe('owned');
    expect(world.getOwnedCells()).toHaveLength(2);
  });

  it('allows only one Crystal Spire across owned buildable hexes', () => {
    const world = new HexWorld(() => 0);
    const deadCells = world.cells.filter((cell) => cell.type === 'dead');

    const firstOwned = world.completeConquest(deadCells[0]!.coord)!;
    const secondOwned = world.completeConquest(deadCells[1]!.coord)!;

    expect(world.canBuild(firstOwned.coord, 'spire')).toBe(true);
    expect(world.placeBuilding(firstOwned.coord, 'spire')?.buildingId).toBe('spire');
    expect(world.canBuild(firstOwned.coord, 'spire')).toBe(false);
    expect(world.canBuild(secondOwned.coord, 'spire')).toBe(false);
    expect(world.placeBuilding(secondOwned.coord, 'spire')).toBeNull();
  });
});
