import type { ExpansionEvent, HexCell, HexCoord, WorldBounds } from '@/game/types';
import { tuning } from '@/game/tuning';
import { HexGrid } from '@/entities/world/HexGrid';
import {
  applyExpansion,
  canExpand,
  type ChooseIndex,
} from '@/entities/world/WorldExpansion';
import { computeWorldBounds } from '@/systems/cameraMath';
import { randomInt } from '@/utils/random';

export class HexWorld {
  readonly grid: HexGrid;
  private cellsInternal: HexCell[];
  bounds: WorldBounds;
  stage: number;
  fillLevel = 0;
  fillThreshold: number;
  private readonly chooseIndex: ChooseIndex;

  constructor(chooseIndex: ChooseIndex = (length) => randomInt(0, length - 1)) {
    this.grid = new HexGrid(tuning.worldHexSize);
    this.stage = 1;
    this.fillThreshold = tuning.initialExpansionThreshold;
    this.cellsInternal = this.grid.createDisk(tuning.initialWorldRadius);
    this.chooseIndex = chooseIndex;
    this.assignStrategicCells(this.cellsInternal, this.stage);
    this.bounds = this.computeBounds();
  }

  get cells(): HexCell[] {
    return this.cellsInternal;
  }

  findCell(coord: HexCoord): HexCell | null {
    return (
      this.cellsInternal.find(
        (cell) => cell.coord.q === coord.q && cell.coord.r === coord.r,
      ) ?? null
    );
  }

  getOwnedCell(ownerId = 'player'): HexCell | null {
    return this.cellsInternal.find((cell) => cell.ownerId === ownerId) ?? null;
  }

  hasOwnedCell(ownerId = 'player'): boolean {
    return this.getOwnedCell(ownerId) !== null;
  }

  getActiveConquestCell(): HexCell | null {
    return this.cellsInternal.find((cell) => cell.conquestState === 'active') ?? null;
  }

  canConquerCell(coord: HexCoord, ownerId = 'player'): boolean {
    const cell = this.findCell(coord);
    if (!cell) {
      return false;
    }

    return (
      cell.type === 'dead' &&
      !cell.ownerId &&
      cell.conquestState !== 'active' &&
      !this.getActiveConquestCell() &&
      !this.hasOwnedCell(ownerId)
    );
  }

  beginConquest(coord: HexCoord): HexCell | null {
    if (!this.canConquerCell(coord)) {
      return null;
    }

    const existing = this.getActiveConquestCell();
    if (existing) {
      existing.conquestState = undefined;
    }

    const target = this.findCell(coord);
    if (!target) {
      return null;
    }

    target.conquestState = 'active';
    target.buildable = false;
    return target;
  }

  clearActiveConquest(): void {
    const active = this.getActiveConquestCell();
    if (active?.conquestState === 'active') {
      active.conquestState = undefined;
    }
  }

  completeConquest(coord: HexCoord, ownerId = 'player'): HexCell | null {
    const target = this.findCell(coord);
    if (!target) {
      return null;
    }

    target.ownerId = ownerId;
    target.buildable = true;
    target.conquestState = 'owned';
    return target;
  }

  addFill(amount: number): ExpansionEvent | null {
    this.fillLevel += amount;
    if (!canExpand(this.fillLevel, this.fillThreshold)) {
      return null;
    }

    const expanded = applyExpansion(
      this.grid,
      {
        stage: this.stage,
        fillLevel: this.fillLevel,
        fillThreshold: this.fillThreshold,
        cells: this.cellsInternal,
      },
      tuning.expansionThresholdStep,
      this.chooseIndex,
    );
    this.assignStrategicCells(expanded.event.newCells, expanded.stage);

    this.stage = expanded.stage;
    this.fillLevel = expanded.fillLevel;
    this.fillThreshold = expanded.fillThreshold;
    this.cellsInternal = expanded.cells;
    this.bounds = this.computeBounds();
    return expanded.event;
  }

  private assignStrategicCells(cells: HexCell[], stage: number): void {
    const reservedCellKeys = new Set<string>();
    const purifiedCell = this.assignRandomCellType(cells, 'purified');
    if (purifiedCell) {
      reservedCellKeys.add(`${purifiedCell.coord.q},${purifiedCell.coord.r}`);
    }
    if (stage >= 3) {
      this.assignRandomCellType(cells, 'enriched', reservedCellKeys);
    }
  }

  private assignRandomCellType(
    cells: HexCell[],
    type: HexCell['type'],
    reservedCellKeys: ReadonlySet<string> = new Set<string>(),
  ): HexCell | null {
    const availableCells = cells.filter(
      (cell) => !reservedCellKeys.has(`${cell.coord.q},${cell.coord.r}`),
    );
    if (availableCells.length === 0) {
      return null;
    }

    const index = this.chooseIndex(availableCells.length);
    const safeIndex = Math.max(0, Math.min(availableCells.length - 1, index));
    const targetCell = availableCells[safeIndex] ?? null;
    if (!targetCell) {
      return null;
    }
    targetCell.type = type;
    return targetCell;
  }

  private computeBounds(): WorldBounds {
    return computeWorldBounds(this.cellsInternal, tuning.cameraFitPaddingPx);
  }
}
