import type * as Phaser from 'phaser';
import * as planck from 'planck';
import type { HexCell, PlantType } from '@/game/types';
import type { Plant } from '@/entities/plants/Plant';
import { FiberPlant } from '@/entities/plants/fiberPlant';
import { resolvePlantAnchorInHex } from '@/entities/plants/plantPlacement';
import { createCoordKey } from '@/entities/world/WorldExpansion';

export class PlantFactory {
  private serial = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: planck.World,
  ) {}

  create(cell: HexCell, type: PlantType = 'fiberPlant'): Plant {
    this.serial += 1;
    const plantId = `plant-${this.serial}`;
    const anchor = resolvePlantAnchorInHex(cell);
    const cellKey = createCoordKey(cell.coord);

    switch (type) {
      case 'fiberPlant':
        return new FiberPlant(
          this.scene,
          this.world,
          plantId,
          cellKey,
          anchor.x,
          anchor.y,
        );
      default:
        throw new Error(`Plant type "${type}" is not implemented yet.`);
    }
  }
}
