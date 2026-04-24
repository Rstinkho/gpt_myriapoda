import type { HexCell, HexCoord } from '@/game/types';
import { HexGrid } from '@/entities/world/HexGrid';

export interface HexWorldStatePreset {
  stage: number;
  fillLevel: number;
  fillThreshold: number;
  cells: HexCell[];
  progressRegionCoords?: HexCoord[];
}

export const tutorialPlantCoord: HexCoord = { q: -1, r: 1 };
export const tutorialConquestCoord: HexCoord = { q: 1, r: 0 };
export const tutorialShellbackCoord: HexCoord = { q: 0, r: -1 };
export const tutorialLoosePickupCoord: HexCoord = { q: 0, r: 0 };

const tutorialBaseCoords: readonly HexCoord[] = [
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: -1 },
  { q: 0, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
] as const;

const corridorCoords: readonly HexCoord[] = [
  { q: 2, r: 0 },
  { q: 3, r: 0 },
] as const;

const postTutorialMainRegionCenter: HexCoord = { q: 5, r: 0 };

function cloneCell(cell: HexCell): HexCell {
  return {
    coord: { ...cell.coord },
    centerX: cell.centerX,
    centerY: cell.centerY,
    unlocked: cell.unlocked,
    type: cell.type,
    ownerId: cell.ownerId,
    buildable: cell.buildable,
    buildingId: cell.buildingId,
    conquestState: cell.conquestState,
  };
}

function createCellMap(cells: HexCell[]): Map<string, HexCell> {
  return new Map(cells.map((cell) => [`${cell.coord.q},${cell.coord.r}`, cloneCell(cell)]));
}

export function createTutorialWorldPreset(grid: HexGrid): HexWorldStatePreset {
  const cells = tutorialBaseCoords.map((coord) => {
    const cell = grid.createCell({ ...coord });
    if (coord.q === tutorialPlantCoord.q && coord.r === tutorialPlantCoord.r) {
      cell.type = 'purified';
    }
    return cell;
  });

  return {
    stage: 1,
    fillLevel: 0,
    fillThreshold: 1_000_000,
    cells,
    progressRegionCoords: tutorialBaseCoords.map((coord) => ({ ...coord })),
  };
}

export function createPostTutorialWorldPreset(
  grid: HexGrid,
  existingCells: HexCell[],
): HexWorldStatePreset {
  const cellsByKey = createCellMap(existingCells);

  for (const coord of corridorCoords) {
    const key = `${coord.q},${coord.r}`;
    if (cellsByKey.has(key)) {
      continue;
    }
    const cell = grid.createCell({ ...coord });
    cell.type = 'corridor';
    cellsByKey.set(key, cell);
  }

  const mainRegionCoords = grid.createDisk(1).map((cell) => ({
    q: cell.coord.q + postTutorialMainRegionCenter.q,
    r: cell.coord.r + postTutorialMainRegionCenter.r,
  }));
  for (const coord of mainRegionCoords) {
    const key = `${coord.q},${coord.r}`;
    if (cellsByKey.has(key)) {
      continue;
    }
    const cell = grid.createCell(coord);
    if (
      (coord.q === 4 && coord.r === 1) ||
      (coord.q === 6 && coord.r === -1)
    ) {
      cell.type = 'purified';
    }
    cellsByKey.set(key, cell);
  }

  return {
    stage: 1,
    fillLevel: 0,
    fillThreshold: 20,
    cells: [...cellsByKey.values()],
    progressRegionCoords: mainRegionCoords,
  };
}
