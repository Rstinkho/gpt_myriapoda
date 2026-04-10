import type { ExpansionEvent, HexCell } from '@/game/types';
import { tuning } from '@/game/tuning';
import { HexGrid } from '@/entities/world/HexGrid';
import { applyExpansion, canExpand } from '@/entities/world/WorldExpansion';

export class HexWorld {
  readonly grid: HexGrid;
  private cellsInternal: HexCell[];
  stage: number;
  fillLevel = 0;
  fillThreshold: number;

  constructor() {
    this.grid = new HexGrid(tuning.worldHexSize);
    this.stage = 1;
    this.fillThreshold = tuning.initialExpansionThreshold;
    this.cellsInternal = this.grid.createDisk(tuning.initialWorldRadius);
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
    );

    this.stage = expanded.stage;
    this.fillLevel = expanded.fillLevel;
    this.fillThreshold = expanded.fillThreshold;
    this.cellsInternal = expanded.cells;
    return expanded.event;
  }
}
