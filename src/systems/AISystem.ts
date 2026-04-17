import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { Enemy, isLeechEnemy, isShellbackEnemy } from '@/entities/enemies/Enemy';
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
import {
  clampPointToRadius,
  createShellbackPatrolPoint,
  createShellbackSteering,
  getShellbackClawOrigin,
  isWithinShellbackAggroRadius,
  stepShellbackState,
} from '@/entities/enemies/shellback/ShellbackAI';
import type { DashStateSnapshot } from '@/game/types';
import { pixelsToMeters, vec2ToPixels } from '@/physics/PhysicsUtils';
import type { PlayerDamageSystem } from '@/systems/PlayerDamageSystem';

type PlayerDamageResolver = Pick<
  PlayerDamageSystem,
  'applyShellbackStrike' | 'findShellbackStrikeTarget'
>;

export class AISystem {
  private elapsed = 0;

  // Scratch Vec2s reused across the whole update to avoid ~5 allocations per
  // enemy per fixed step (60 Hz). planck's body setters all copy the input
  // values internally (they use `setVec2`/`copyVec2`), so reusing a single
  // instance per role is safe.
  private readonly forceScratch = planck.Vec2(0, 0);
  private readonly velocityScratch = planck.Vec2(0, 0);
  private readonly positionScratch = planck.Vec2(0, 0);

  constructor(private readonly playerDamageSystem?: PlayerDamageResolver) {}

  update(
    enemies: Map<string, Enemy>,
    myriapoda: Myriapoda,
    dashState: DashStateSnapshot,
  ): void {
    this.elapsed += tuning.fixedStepSeconds;
    const headPosition = myriapoda.head.body.getPosition();
    const headPositionPixels = vec2ToPixels(headPosition);
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
          this.forceScratch.setNum(steering.forceX, steering.forceY);
          enemy.body.applyForceToCenter(this.forceScratch, true);

          const velocity = enemy.body.getLinearVelocity();
          const clampedVelocity = clampEnemyVelocity(
            { x: velocity.x, y: velocity.y },
            tuning.jellyfishMaxSpeed,
          );
          this.velocityScratch.setNum(clampedVelocity.x, clampedVelocity.y);
          enemy.body.setLinearVelocity(this.velocityScratch);
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

        case 'shellback':
          this.updateShellback(enemy, myriapoda, headPositionPixels);
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
    const speedMultiplier = enemy.speedMultiplier ?? 1;
    const leechSeekForce = tuning.leechSeekForce * speedMultiplier;
    const leechMaxSpeed = tuning.leechMaxSpeed * speedMultiplier;
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
      this.positionScratch.setNum(
        pixelsToMeters(attachedPoint.x),
        pixelsToMeters(attachedPoint.y),
      );
      enemy.body.setTransform(this.positionScratch, attachedPoint.angle);
      this.velocityScratch.setZero();
      enemy.body.setLinearVelocity(this.velocityScratch);
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
      this.velocityScratch.setNum(
        detachDirectionX * tuning.leechDetachKnockbackSpeed,
        detachDirectionY * tuning.leechDetachKnockbackSpeed,
      );
      enemy.body.setLinearVelocity(this.velocityScratch);
      return;
    }

    if (enemy.state !== 'seeking') {
      const velocity = enemy.body.getLinearVelocity();
      const clampedVelocity = clampEnemyVelocity(
        { x: velocity.x, y: velocity.y },
        leechMaxSpeed,
      );
      this.velocityScratch.setNum(clampedVelocity.x, clampedVelocity.y);
      enemy.body.setLinearVelocity(this.velocityScratch);
      return;
    }

    const targetMetersX = pixelsToMeters(targetPixels.x);
    const targetMetersY = pixelsToMeters(targetPixels.y);
    const steering = createLeechSteering(
      { x: currentPosition.x, y: currentPosition.y },
      { x: targetMetersX, y: targetMetersY },
      leechSeekForce,
      this.elapsed,
      getLeechPhaseSeed(enemy.id),
    );
    this.forceScratch.setNum(steering.forceX, steering.forceY);
    enemy.body.applyForceToCenter(this.forceScratch, true);

    const velocity = enemy.body.getLinearVelocity();
    const clampedVelocity = clampEnemyVelocity(
      { x: velocity.x, y: velocity.y },
      leechMaxSpeed,
    );
    this.velocityScratch.setNum(clampedVelocity.x, clampedVelocity.y);
    enemy.body.setLinearVelocity(this.velocityScratch);
    if (Math.hypot(clampedVelocity.x, clampedVelocity.y) > 0.01) {
      enemy.body.setTransform(
        enemy.body.getPosition(),
        Math.atan2(clampedVelocity.y, clampedVelocity.x),
      );
    }
    enemy.body.setAngularVelocity(0);
  }

  private updateShellback(
    enemy: Extract<Enemy, { type: 'shellback' }>,
    myriapoda: Myriapoda,
    headPositionPixels: { x: number; y: number },
  ): void {
    const positionMeters = enemy.body.getPosition();
    const positionPixels = vec2ToPixels(positionMeters);
    const guardCenter = {
      x: enemy.guardCenterX,
      y: enemy.guardCenterY,
    };
    const hasAggro = isWithinShellbackAggroRadius(headPositionPixels, guardCenter);
    const desiredPoint = hasAggro
      ? clampPointToRadius(
          headPositionPixels,
          guardCenter,
          tuning.shellbackGuardOrbitRadiusPx * 1.4,
        )
      : createShellbackPatrolPoint(
          guardCenter,
          this.elapsed,
          enemy.phaseSeed,
          tuning.shellbackGuardOrbitRadiusPx,
        );
    const desiredMetersX = pixelsToMeters(desiredPoint.x);
    const desiredMetersY = pixelsToMeters(desiredPoint.y);
    const steeringStrength =
      enemy.shellState === 'shelled'
        ? tuning.shellbackMoveForce * 0.55
        : tuning.shellbackMoveForce;
    const steering = createShellbackSteering(
      { x: positionMeters.x, y: positionMeters.y },
      { x: desiredMetersX, y: desiredMetersY },
      steeringStrength,
      this.elapsed,
      enemy.phaseSeed,
    );
    this.forceScratch.setNum(steering.forceX, steering.forceY);
    enemy.body.applyForceToCenter(this.forceScratch, true);

    const velocity = enemy.body.getLinearVelocity();
    const clampedVelocity = clampEnemyVelocity(
      { x: velocity.x, y: velocity.y },
      enemy.shellState === 'shelled'
        ? tuning.shellbackMaxSpeed * 0.55
        : tuning.shellbackMaxSpeed,
    );
    this.velocityScratch.setNum(clampedVelocity.x, clampedVelocity.y);
    enemy.body.setLinearVelocity(this.velocityScratch);

    const facingAngle = hasAggro
      ? Math.atan2(
          headPositionPixels.y - positionPixels.y,
          headPositionPixels.x - positionPixels.x,
        )
      : Math.hypot(clampedVelocity.x, clampedVelocity.y) > 0.01
        ? Math.atan2(clampedVelocity.y, clampedVelocity.x)
        : Math.atan2(
            desiredPoint.y - positionPixels.y,
            desiredPoint.x - positionPixels.x,
          );
    enemy.body.setTransform(enemy.body.getPosition(), facingAngle);
    enemy.body.setAngularVelocity(0);

    const clawOrigin = getShellbackClawOrigin(positionPixels, facingAngle, enemy.activeClaw);
    const strikeTarget = this.playerDamageSystem?.findShellbackStrikeTarget(
      myriapoda,
      clawOrigin,
    ) ?? null;
    const nextState = stepShellbackState(
      {
        shellState: enemy.shellState,
        shellTimer: enemy.shellTimer,
        attackState: enemy.attackState,
        attackTimer: enemy.attackTimer,
        attackTarget: enemy.attackTarget,
        activeClaw: enemy.activeClaw,
      },
      {
        deltaSeconds: tuning.fixedStepSeconds,
        hasAggro,
        strikeTarget: strikeTarget ? { x: strikeTarget.x, y: strikeTarget.y } : null,
      },
    );

    enemy.shellState = nextState.shellState;
    enemy.shellTimer = nextState.shellTimer;
    enemy.attackState = nextState.attackState;
    enemy.attackTimer = nextState.attackTimer;
    enemy.attackTarget = nextState.attackTarget;
    enemy.activeClaw = nextState.activeClaw;
    enemy.isVulnerable = nextState.isVulnerable;

    if (nextState.didStrike && this.playerDamageSystem) {
      this.playerDamageSystem.applyShellbackStrike(myriapoda, clawOrigin);
    }
  }
}
