import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { Enemy } from '@/entities/enemies/Enemy';
import { JellyfishView } from '@/entities/enemies/jellyfish/JellyfishView';
import { EnemyBody } from '@/physics/bodies/EnemyBody';

export class JellyfishEnemy implements Enemy {
  readonly type = 'jellyfish' as const;
  readonly body: planck.Body;
  readonly view: JellyfishView;
  health = tuning.enemyHealth;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    x: number,
    y: number,
  ) {
    const enemyBody = new EnemyBody(world, id, x, y, tuning.enemyRadius);
    this.body = enemyBody.body;
    this.view = new JellyfishView(scene, id);
  }

  updateVisual(deltaSeconds: number): void {
    this.view.update(this.body, deltaSeconds);
  }

  destroy(world: planck.World): void {
    world.destroyBody(this.body);
    this.view.destroy();
  }
}
