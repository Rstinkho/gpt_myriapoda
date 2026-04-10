import Phaser from 'phaser';
import * as planck from 'planck';
import type { PickupType } from '@/game/types';
import { Pickup, type PickupOptions } from '@/entities/pickups/Pickup';
import { randomItem } from '@/utils/random';

const pickupTypes: PickupType[] = ['triangle', 'crystal', 'bone'];

export class PickupFactory {
  private serial = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: planck.World,
  ) {}

  create(
    x: number,
    y: number,
    type: PickupType = randomItem(pickupTypes),
    options: PickupOptions = {},
  ): Pickup {
    this.serial += 1;
    return new Pickup(this.scene, this.world, `pickup-${this.serial}`, type, x, y, options);
  }
}
