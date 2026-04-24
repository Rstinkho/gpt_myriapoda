import type { ExpansionEvent, HexCell, HexCoord } from '@/game/types';
import { HexGrid } from '@/entities/world/HexGrid';
import { randomInt } from '@/utils/random';

export interface ExpansionState {
  stage: number;
  fillLevel: number;
  fillThreshold: number;
  cells: HexCell[];
}

export type ChooseIndex = (length: number) => number;

export function canExpand(fillLevel: number, threshold: number): boolean {
  return fillLevel >= threshold;
}

export function createCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function areHexCoordsAdjacent(left: HexCoord, right: HexCoord): boolean {
  const dq = right.q - left.q;
  const dr = right.r - left.r;
  return (
    (dq === 1 && dr === 0) ||
    (dq === 1 && dr === -1) ||
    (dq === 0 && dr === -1) ||
    (dq === -1 && dr === 0) ||
    (dq === -1 && dr === 1) ||
    (dq === 0 && dr === 1)
  );
}

export function collectFrontierCoords(
  grid: HexGrid,
  cells: HexCell[],
  occupiedCells: HexCell[] = cells,
): HexCoord[] {
  const unlockedKeys = new Set(occupiedCells.map((cell) => createCoordKey(cell.coord)));
  const frontier = new Map<string, HexCoord>();

  for (const cell of cells) {
    for (const neighbor of grid.neighbors(cell.coord)) {
      const key = createCoordKey(neighbor);
      if (!unlockedKeys.has(key)) {
        frontier.set(key, neighbor);
      }
    }
  }

  return [...frontier.values()];
}

export function selectConnectedFrontierCluster(
  grid: HexGrid,
  cells: HexCell[],
  clusterSize: number,
  chooseIndex: ChooseIndex = (length) => randomInt(0, length - 1),
  occupiedCells: HexCell[] = cells,
): HexCell[] {
  const frontier = collectFrontierCoords(grid, cells, occupiedCells);
  if (frontier.length <= clusterSize) {
    return frontier.slice(0, clusterSize).map((coord) => grid.createCell(coord));
  }

  const availableSeeds = frontier.map((_, index) => index);
  while (availableSeeds.length > 0) {
    const seedPoolIndex = chooseIndex(availableSeeds.length);
    const seedIndex = availableSeeds.splice(seedPoolIndex, 1)[0];
    const selected: HexCoord[] = [frontier[seedIndex]];
    const selectedKeys = new Set([createCoordKey(frontier[seedIndex])]);

    while (selected.length < clusterSize) {
      const candidates = frontier.filter((coord) => {
        const key = createCoordKey(coord);
        if (selectedKeys.has(key)) {
          return false;
        }

        return selected.some((chosen) => areHexCoordsAdjacent(chosen, coord));
      });

      if (candidates.length === 0) {
        break;
      }

      const nextCoord = candidates[chooseIndex(candidates.length)];
      selected.push(nextCoord);
      selectedKeys.add(createCoordKey(nextCoord));
    }

    if (selected.length === clusterSize) {
      return selected.map((coord) => grid.createCell(coord));
    }
  }

  return frontier.slice(0, clusterSize).map((coord) => grid.createCell(coord));
}

export function applyExpansion(
  grid: HexGrid,
  state: ExpansionState,
  thresholdStep: number,
  chooseIndex?: ChooseIndex,
  frontierSourceCells: HexCell[] = state.cells,
): ExpansionState & { event: ExpansionEvent } {
  const nextStage = state.stage + 1;
  const newCells = selectConnectedFrontierCluster(
    grid,
    frontierSourceCells,
    3,
    chooseIndex,
    state.cells,
  );

  return {
    stage: nextStage,
    fillLevel: state.fillLevel - state.fillThreshold,
    fillThreshold: state.fillThreshold + thresholdStep,
    cells: [...state.cells, ...newCells],
    event: {
      stage: nextStage,
      newCells,
    },
  };
}
