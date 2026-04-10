import type { ExpansionEvent, HexCell, WorldBounds } from '@/game/types';
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
    this.assignRandomPurifiedCell(this.cellsInternal);
    this.bounds = this.computeBounds();
  }

  get cells(): HexCell[] {
    return this.cellsInternal;
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
    this.assignRandomPurifiedCell(expanded.event.newCells);

    this.stage = expanded.stage;
    this.fillLevel = expanded.fillLevel;
    this.fillThreshold = expanded.fillThreshold;
    this.cellsInternal = expanded.cells;
    this.bounds = this.computeBounds();
    return expanded.event;
  }

  private assignRandomPurifiedCell(cells: HexCell[]): void {
    if (cells.length === 0) {
      return;
    }

    const index = this.chooseIndex(cells.length);
    const safeIndex = Math.max(0, Math.min(cells.length - 1, index));
    cells[safeIndex].type = 'purified';
  }

  private computeBounds(): WorldBounds {
    return computeWorldBounds(this.cellsInternal, tuning.cameraFitPaddingPx);
  }
}
