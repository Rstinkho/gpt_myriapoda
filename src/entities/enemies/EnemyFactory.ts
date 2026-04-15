import * as Phaser from 'phaser';
import * as planck from 'planck';
import type { Enemy } from '@/entities/enemies/Enemy';
import { JellyfishEnemy } from '@/entities/enemies/jellyfish';
import { LeechEnemy } from '@/entities/enemies/leech';
import { ShellbackEnemy } from '@/entities/enemies/shellback';
import type { EnemySpawnContext, EnemyType } from '@/game/types';

export class EnemyFactory {
  private serial = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: planck.World,
  ) {}

  create(spawn: EnemySpawnContext, type: EnemyType = 'jellyfish'): Enemy {
    this.serial += 1;
    const enemyId = `enemy-${this.serial}`;

    switch (type) {
      case 'jellyfish':
        return new JellyfishEnemy(this.scene, this.world, enemyId, spawn.x, spawn.y);
      case 'leech':
        return new LeechEnemy(this.scene, this.world, enemyId, spawn);
      case 'shellback':
        return new ShellbackEnemy(this.scene, this.world, enemyId, spawn);
    }

    throw new Error(`Unsupported enemy type: ${String(type)}`);
  }
}
