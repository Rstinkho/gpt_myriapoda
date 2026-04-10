import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { Enemy } from '@/entities/enemies/Enemy';
import {
  clampEnemyVelocity,
  createJellyfishSteering,
  getJellyfishPhaseSeed,
} from '@/entities/enemies/jellyfish/JellyfishAI';

export class AISystem {
  private elapsed = 0;

  update(enemies: Map<string, Enemy>, headPosition: { x: number; y: number }): void {
    this.elapsed += tuning.fixedStepSeconds;
    for (const enemy of enemies.values()) {
      const position = enemy.body.getPosition();
      switch (enemy.type) {
        case 'jellyfish': {
          const steering = createJellyfishSteering(
            { x: position.x, y: position.y },
            headPosition,
            tuning.enemyChaseForce,
            this.elapsed,
            getJellyfishPhaseSeed(enemy.id),
          );
          enemy.body.applyForceToCenter(planck.Vec2(steering.forceX, steering.forceY), true);

          const velocity = enemy.body.getLinearVelocity();
          const clampedVelocity = clampEnemyVelocity(
            { x: velocity.x, y: velocity.y },
            tuning.enemyMaxSpeed,
          );
          enemy.body.setLinearVelocity(planck.Vec2(clampedVelocity.x, clampedVelocity.y));
          break;
        }
      }
    }
  }
}
