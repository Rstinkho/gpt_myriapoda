import * as Phaser from 'phaser';
import * as planck from 'planck';
import type { Enemy } from '@/entities/enemies/Enemy';
import { JellyfishEnemy } from '@/entities/enemies/jellyfish';
import { LeechEnemy } from '@/entities/enemies/leech';
import type { EnemyType } from '@/game/types';

export class EnemyFactory {
  private serial = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: planck.World,
  ) {}

  create(x: number, y: number, type: EnemyType = 'jellyfish'): Enemy {
    this.serial += 1;
    const enemyId = `enemy-${this.serial}`;

    switch (type) {
      case 'jellyfish':
        return new JellyfishEnemy(this.scene, this.world, enemyId, x, y);
      case 'leech':
        return new LeechEnemy(this.scene, this.world, enemyId, x, y);
    }

    throw new Error(`Unsupported enemy type: ${String(type)}`);
  }
}
