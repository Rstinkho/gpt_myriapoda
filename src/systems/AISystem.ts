import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { Enemy, isLeechEnemy } from '@/entities/enemies/Enemy';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import {
  clampEnemyVelocity,
  createJellyfishSteering,
  getJellyfishPhaseSeed,
} from '@/entities/enemies/jellyfish/JellyfishAI';
import {
  createLeechSteering,
  getLeechPhaseSeed,
  isWithinLeechLatchDistance,
  pickLeechLatchSlot,
  stepLeechState,
} from '@/entities/enemies/leech';
import type { DashStateSnapshot } from '@/game/types';
import { vec2FromPixels, vec2ToPixels } from '@/physics/PhysicsUtils';

export class AISystem {
  private elapsed = 0;

  update(
    enemies: Map<string, Enemy>,
    myriapoda: Myriapoda,
    dashState: DashStateSnapshot,
  ): void {
    this.elapsed += tuning.fixedStepSeconds;
    const headPosition = myriapoda.head.body.getPosition();
    const headSpeedRatio = Math.min(
      1,
      Math.hypot(
        myriapoda.head.body.getLinearVelocity().x,
        myriapoda.head.body.getLinearVelocity().y,
      ) / Math.max(0.0001, tuning.maxSpeed),
    );
    const occupiedLatchSlots = new Set<number>();

    for (const enemy of enemies.values()) {
      if (
        isLeechEnemy(enemy) &&
        enemy.attachedLatchSlotIndex !== null &&
        (enemy.state === 'latched' || enemy.state === 'drainedOut')
      ) {
        occupiedLatchSlots.add(enemy.attachedLatchSlotIndex);
      }
    }

    for (const enemy of enemies.values()) {
      const position = enemy.body.getPosition();
      switch (enemy.type) {
        case 'jellyfish': {
          const steering = createJellyfishSteering(
            { x: position.x, y: position.y },
            headPosition,
            tuning.jellyfishChaseForce,
            this.elapsed,
            getJellyfishPhaseSeed(enemy.id),
          );
          enemy.body.applyForceToCenter(planck.Vec2(steering.forceX, steering.forceY), true);

          const velocity = enemy.body.getLinearVelocity();
          const clampedVelocity = clampEnemyVelocity(
            { x: velocity.x, y: velocity.y },
            tuning.jellyfishMaxSpeed,
          );
          enemy.body.setLinearVelocity(planck.Vec2(clampedVelocity.x, clampedVelocity.y));
          break;
        }

        case 'leech':
          this.updateLeech(
            enemy,
            myriapoda,
            occupiedLatchSlots,
            headSpeedRatio,
            dashState,
          );
          break;
      }
    }
  }

  private updateLeech(
    enemy: Extract<Enemy, { type: 'leech' }>,
    myriapoda: Myriapoda,
    occupiedLatchSlots: Set<number>,
    headSpeedRatio: number,
    dashState: DashStateSnapshot,
  ): void {
    const currentPosition = enemy.body.getPosition();
    const currentPositionPixels = vec2ToPixels(currentPosition);
    const fallbackSlot =
      enemy.attachedLatchSlotIndex ??
      pickLeechLatchSlot(occupiedLatchSlots, tuning.leechLatchSlotCount);
    const latchPoint =
      fallbackSlot !== null ? myriapoda.body.getStomachLatchPoint(fallbackSlot) : null;
    const stomachAnchor = myriapoda.stomach.getAnchor();
    const targetPixels = latchPoint ?? {
      x: stomachAnchor.x,
      y: stomachAnchor.y,
      angle: 0,
      slotIndex: -1,
    };

    const nextState = stepLeechState(
      {
        state: enemy.state,
        attachedLatchSlotIndex: enemy.attachedLatchSlotIndex,
        drainTimer: enemy.drainTimer,
        detachProgress: enemy.detachProgress,
        recoveryTimer: enemy.recoveryTimer,
      },
      {
        deltaSeconds: tuning.fixedStepSeconds,
        stomachHasStoredParticles: myriapoda.stomach.hasStoredParticles(),
        canLatch: fallbackSlot !== null,
        withinLatchDistance:
          latchPoint !== null &&
          isWithinLeechLatchDistance(
            currentPositionPixels,
            latchPoint,
            tuning.leechLatchDistancePx,
          ),
        headSpeedRatio,
        dashShakeStrength: dashState.shakeStrength,
      },
    );

    if (
      enemy.attachedLatchSlotIndex !== null &&
      nextState.didDetach
    ) {
      occupiedLatchSlots.delete(enemy.attachedLatchSlotIndex);
    }

    enemy.state = nextState.state;
    enemy.drainTimer = nextState.drainTimer;
    enemy.detachProgress = nextState.detachProgress;
    enemy.recoveryTimer = nextState.recoveryTimer;

    if (nextState.didLatch && fallbackSlot !== null) {
      enemy.attachedLatchSlotIndex = fallbackSlot;
      occupiedLatchSlots.add(fallbackSlot);
    } else if (nextState.didDetach) {
      enemy.attachedLatchSlotIndex = null;
    }

    if (nextState.shouldConsumeParticle) {
      myriapoda.stomach.consumeOldestStoredParticle();
    }

    if (
      enemy.attachedLatchSlotIndex !== null &&
      (enemy.state === 'latched' || enemy.state === 'drainedOut')
    ) {
      const attachedPoint = myriapoda.body.getStomachLatchPoint(enemy.attachedLatchSlotIndex);
      enemy.body.setTransform(
        vec2FromPixels(attachedPoint.x, attachedPoint.y),
        attachedPoint.angle,
      );
      enemy.body.setLinearVelocity(planck.Vec2(0, 0));
      enemy.body.setAngularVelocity(0);
      return;
    }

    if (nextState.didDetach) {
      const stomachAnchor = myriapoda.stomach.getAnchor();
      const dx = currentPositionPixels.x - stomachAnchor.x;
      const dy = currentPositionPixels.y - stomachAnchor.y;
      const distance = Math.hypot(dx, dy);
      const detachDirectionX =
        distance > 0.001
          ? dx / distance
          : dashState.directionX || Math.cos(enemy.body.getAngle());
      const detachDirectionY =
        distance > 0.001
          ? dy / distance
          : dashState.directionY || Math.sin(enemy.body.getAngle());
      enemy.body.setLinearVelocity(
        planck.Vec2(
          detachDirectionX * tuning.leechDetachKnockbackSpeed,
          detachDirectionY * tuning.leechDetachKnockbackSpeed,
        ),
      );
      return;
    }

    if (enemy.state !== 'seeking') {
      const velocity = enemy.body.getLinearVelocity();
      const clampedVelocity = clampEnemyVelocity(
        { x: velocity.x, y: velocity.y },
        tuning.leechMaxSpeed,
      );
      enemy.body.setLinearVelocity(planck.Vec2(clampedVelocity.x, clampedVelocity.y));
      return;
    }

    const targetMeters = vec2FromPixels(targetPixels.x, targetPixels.y);
    const steering = createLeechSteering(
      { x: currentPosition.x, y: currentPosition.y },
      { x: targetMeters.x, y: targetMeters.y },
      tuning.leechSeekForce,
      this.elapsed,
      getLeechPhaseSeed(enemy.id),
    );
    enemy.body.applyForceToCenter(planck.Vec2(steering.forceX, steering.forceY), true);

    const velocity = enemy.body.getLinearVelocity();
    const clampedVelocity = clampEnemyVelocity(
      { x: velocity.x, y: velocity.y },
      tuning.leechMaxSpeed,
    );
    enemy.body.setLinearVelocity(planck.Vec2(clampedVelocity.x, clampedVelocity.y));
    if (Math.hypot(clampedVelocity.x, clampedVelocity.y) > 0.01) {
      enemy.body.setTransform(
        enemy.body.getPosition(),
        Math.atan2(clampedVelocity.y, clampedVelocity.x),
      );
    }
    enemy.body.setAngularVelocity(0);
  }
}
