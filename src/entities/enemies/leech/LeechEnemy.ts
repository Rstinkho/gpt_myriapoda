import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { LeechEnemyState } from '@/entities/enemies/Enemy';
import { LeechView } from '@/entities/enemies/leech/LeechView';
import { EnemyBody } from '@/physics/bodies/EnemyBody';

export class LeechEnemy implements LeechEnemyState {
  readonly type = 'leech' as const;
  readonly body: planck.Body;
  readonly view: LeechView;
  readonly radiusPx = tuning.leechRadius;
  health = tuning.leechHealth;
  state: LeechEnemyState['state'] = 'seeking';
  attachedLatchSlotIndex: number | null = null;
  drainTimer = tuning.leechDrainIntervalSeconds;
  detachProgress = 0;
  recoveryTimer = 0;

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
      tuning.leechRadius,
      tuning.leechLinearDamping,
      tuning.leechAngularDamping,
    );
    this.body = enemyBody.body;
    this.view = new LeechView(scene, id);
  }

  updateVisual(deltaSeconds: number): void {
    this.view.update(
      this.body,
      {
        state: this.state,
        detachProgress: this.detachProgress,
      },
      deltaSeconds,
    );
  }

  destroy(world: planck.World): void {
    world.destroyBody(this.body);
    this.view.destroy();
  }
}
