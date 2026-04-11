import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { JellyfishEnemyState } from '@/entities/enemies/Enemy';
import { JellyfishView } from '@/entities/enemies/jellyfish/JellyfishView';
import { EnemyBody } from '@/physics/bodies/EnemyBody';

export class JellyfishEnemy implements JellyfishEnemyState {
  readonly type = 'jellyfish' as const;
  readonly body: planck.Body;
  readonly view: JellyfishView;
  readonly radiusPx = tuning.jellyfishRadius;
  health = tuning.jellyfishHealth;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    x: number,
    y: number,
  ) {
    const enemyBody = new EnemyBody(
      world,
      id,
      x,
      y,
      tuning.jellyfishRadius,
      tuning.jellyfishLinearDamping,
      tuning.jellyfishAngularDamping,
    );
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
