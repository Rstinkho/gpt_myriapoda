import Phaser from 'phaser';
import * as planck from 'planck';
import type { PickupResourceId, PickupTier } from '@/game/types';
import { Pickup, type PickupOptions } from '@/entities/pickups/Pickup';
import {
  getDefaultPickupResourceId,
  nutrientPickupTiers,
} from '@/entities/pickups/PickupRegistry';
import { randomItem } from '@/utils/random';

export interface PickupCreateOptions extends PickupOptions {
  resourceId?: PickupResourceId;
}

export class PickupFactory {
  private serial = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: planck.World,
  ) {}

  create(
    x: number,
    y: number,
    tier: PickupTier = randomItem([...nutrientPickupTiers]),
    options: PickupCreateOptions = {},
  ): Pickup {
    this.serial += 1;
    const resourceId = options.resourceId ?? getDefaultPickupResourceId(tier);
    return new Pickup(
      this.scene,
      this.world,
      `pickup-${this.serial}`,
      resourceId,
      x,
      y,
      options,
    );
  }
}
