import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { ShellbackEnemyState } from '@/entities/enemies/Enemy';
import { ShellbackView } from '@/entities/enemies/shellback/ShellbackView';
import {
  getShellbackPhaseSeed,
} from '@/entities/enemies/shellback/ShellbackAI';
import type { EnemySpawnContext } from '@/game/types';
import { EnemyBody } from '@/physics/bodies/EnemyBody';
import { createCoordKey } from '@/entities/world/WorldExpansion';

export class ShellbackEnemy implements ShellbackEnemyState {
  readonly type = 'shellback' as const;
  readonly body: planck.Body;
  readonly view: ShellbackView;
  readonly radiusPx = tuning.shellbackRadius;
  readonly guardCellKey: string;
  readonly guardCenterX: number;
  readonly guardCenterY: number;
  readonly phaseSeed: number;
  health = tuning.shellbackHealth;
  shellState: ShellbackEnemyState['shellState'] = 'exposed';
  shellTimer = tuning.shellbackExposedSeconds;
  attackState: ShellbackEnemyState['attackState'] = 'idle';
  attackTimer = 0;
  attackTarget: { x: number; y: number } | null = null;
  activeClaw: ShellbackEnemyState['activeClaw'] = 'left';
  isVulnerable = true;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    spawn: EnemySpawnContext,
  ) {
    const enemyBody = new EnemyBody(
      world,
      id,
      spawn.x,
      spawn.y,
      tuning.shellbackRadius,
      tuning.shellbackLinearDamping,
      tuning.shellbackAngularDamping,
    );
    const guardCell = spawn.guardCell ?? spawn.cell;
    this.body = enemyBody.body;
    this.guardCellKey = createCoordKey(guardCell.coord);
    this.guardCenterX = guardCell.centerX;
    this.guardCenterY = guardCell.centerY;
    this.phaseSeed = getShellbackPhaseSeed(id);
    this.view = new ShellbackView(scene, id);
  }

  updateVisual(deltaSeconds: number): void {
    this.view.update(
      this.body,
      {
        health: this.health,
        shellState: this.shellState,
        shellTimer: this.shellTimer,
        attackState: this.attackState,
        attackTimer: this.attackTimer,
        attackTarget: this.attackTarget,
        activeClaw: this.activeClaw,
        isVulnerable: this.isVulnerable,
      },
      deltaSeconds,
    );
  }

  destroy(world: planck.World): void {
    world.destroyBody(this.body);
    this.view.destroy();
  }
}
