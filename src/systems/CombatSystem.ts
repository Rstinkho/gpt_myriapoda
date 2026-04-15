import * as Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import { Enemy, isLatchedLeech, isShellbackEnemy } from '@/entities/enemies/Enemy';
import { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import type { LimbRuntime } from '@/entities/myriapoda/LimbController';
import { CollisionRegistry } from '@/physics/CollisionRegistry';
import { vec2ToPixels } from '@/physics/PhysicsUtils';
import { isCircleInStrikeCone } from '@/systems/combat/strikeMath';

export function getEnemyTargetPriority(enemy: Enemy): number {
  return isLatchedLeech(enemy) ? 1 : 0;
}

export function canEnemyReceiveLimbDamage(enemy: Enemy): boolean {
  return !isShellbackEnemy(enemy) || enemy.isVulnerable;
}

export class CombatSystem {
  private attackCooldown = 0;
  private activeLimbId: string | null = null;
  private activeEnemyId: string | null = null;
  private activeLimbHitResolved = false;

  constructor(private readonly eventBus: Phaser.Events.EventEmitter) {}

  update(
    myriapoda: Myriapoda,
    enemies: Map<string, Enemy>,
    collisions: CollisionRegistry,
    world: planck.World,
  ): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - tuning.fixedStepSeconds);
    let targetEnemy = this.activeEnemyId ? enemies.get(this.activeEnemyId) ?? null : null;

    let activeLimb = this.activeLimbId
      ? myriapoda.limbs.limbs.find((limb) => limb.id === this.activeLimbId) ?? null
      : null;
    if (activeLimb && !activeLimb.body) {
      this.activeLimbId = null;
      this.activeEnemyId = null;
      this.activeLimbHitResolved = false;
      activeLimb = null;
      targetEnemy = null;
    }
    if (activeLimb && targetEnemy && !this.isEnemyInLimbStrikeCone(myriapoda, activeLimb, targetEnemy)) {
      myriapoda.limbs.releaseAttack(activeLimb.id);
      this.activeLimbId = null;
      this.activeEnemyId = null;
      this.activeLimbHitResolved = false;
      activeLimb = null;
      targetEnemy = null;
    }
    if (activeLimb && targetEnemy && !canEnemyReceiveLimbDamage(targetEnemy)) {
      myriapoda.limbs.releaseAttack(activeLimb.id);
      this.activeLimbId = null;
      this.activeEnemyId = null;
      this.activeLimbHitResolved = false;
      activeLimb = null;
      targetEnemy = null;
    }
    if (!targetEnemy && activeLimb) {
      myriapoda.limbs.releaseAttack(activeLimb.id);
      this.activeLimbId = null;
      this.activeEnemyId = null;
      this.activeLimbHitResolved = false;
      activeLimb = null;
    }
    if (
      activeLimb &&
      (activeLimb.state.name === 'hit' ||
        activeLimb.state.name === 'retract' ||
        (activeLimb.state.name === 'idle' && activeLimb.state.timer > 0))
    ) {
      this.activeLimbId = null;
      this.activeEnemyId = null;
      this.activeLimbHitResolved = false;
      activeLimb = null;
      targetEnemy = null;
    }

    if (!this.activeLimbId && this.attackCooldown === 0) {
      for (const limb of myriapoda.limbs.limbs) {
        if (!myriapoda.limbs.isLimbReady(limb, myriapoda.body)) {
          continue;
        }

        const strikePose = myriapoda.limbs.getStrikePose(limb, myriapoda.body);
        let nearestEnemyForLimb: Enemy | null = null;
        let highestPriority = Number.NEGATIVE_INFINITY;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;
        for (const enemy of enemies.values()) {
          if (!canEnemyReceiveLimbDamage(enemy)) {
            continue;
          }
          const enemyPosition = enemy.body.getPosition();
          const enemyPositionPixels = vec2ToPixels(enemyPosition);
          const distanceSq =
            (strikePose.tipPixels.x - enemyPositionPixels.x) ** 2 +
            (strikePose.tipPixels.y - enemyPositionPixels.y) ** 2;
          const withinCone = this.isEnemyInLimbStrikeCone(myriapoda, limb, enemy);
          const priority = getEnemyTargetPriority(enemy);
          if (
            withinCone &&
            (priority > highestPriority ||
              (priority === highestPriority && distanceSq < nearestDistanceSq))
          ) {
            highestPriority = priority;
            nearestDistanceSq = distanceSq;
            nearestEnemyForLimb = enemy;
          }
        }

        if (nearestEnemyForLimb) {
          this.activeLimbId = limb.id;
          this.activeEnemyId = nearestEnemyForLimb.id;
          this.activeLimbHitResolved = false;
          activeLimb = limb;
          targetEnemy = nearestEnemyForLimb;
          break;
        }
      }
    }

    const targetPosition =
      targetEnemy && this.activeLimbId ? vec2ToPixels(targetEnemy.body.getPosition()) : null;
    for (const limb of myriapoda.limbs.limbs) {
      const shouldTrackTarget = limb.id === this.activeLimbId && targetEnemy !== null;
      const trackedEnemyId = shouldTrackTarget && targetEnemy ? targetEnemy.id : null;
      myriapoda.limbs.setTarget(
        limb.id,
        trackedEnemyId,
        shouldTrackTarget ? targetPosition : null,
      );
    }

    const hits = collisions.drainLimbHits();
    const hitLimbIds = new Set<string>();
    const resolvedLimbIds = new Set<string>();
    for (const hit of hits) {
      if (!this.activeLimbId || hit.limbId !== this.activeLimbId) {
        continue;
      }
      if (this.activeLimbHitResolved) {
        continue;
      }
      if (resolvedLimbIds.has(hit.limbId)) {
        continue;
      }
      const enemy = enemies.get(hit.enemyId);
      if (!enemy || !canEnemyReceiveLimbDamage(enemy)) {
        continue;
      }
      enemy.health = Math.max(0, enemy.health - tuning.limbDamage);
      hitLimbIds.add(hit.limbId);
      resolvedLimbIds.add(hit.limbId);
      if (this.activeLimbId === hit.limbId) {
        this.activeLimbHitResolved = true;
      }
      this.eventBus.emit(GameEvents.cameraImpulse, {
        duration: 0.12,
        zoom: tuning.cameraHitZoom,
        shake: tuning.cameraHitShake,
      });

      if (enemy.health <= 0) {
        const deathPosition = vec2ToPixels(enemy.body.getPosition());
        collisions.forgetEnemy(enemy.id);
        enemy.destroy(world);
        enemies.delete(enemy.id);
        this.eventBus.emit(GameEvents.enemyKilled, {
          enemyId: enemy.id,
          enemyType: enemy.type,
          x: deathPosition.x,
          y: deathPosition.y,
        });
        this.attackCooldown = tuning.limbAttackIntervalSeconds;
        myriapoda.limbs.releaseAttack(hit.limbId);
        this.activeLimbId = null;
        this.activeEnemyId = null;
        this.activeLimbHitResolved = false;
      }
    }

    myriapoda.limbs.update(tuning.fixedStepSeconds, hitLimbIds, myriapoda.body);
  }

  getAttackCooldown(): number {
    return this.attackCooldown;
  }

  getActiveLimbId(): string | null {
    return this.activeLimbId;
  }

  private isEnemyInLimbStrikeCone(
    myriapoda: Myriapoda,
    limb: LimbRuntime,
    enemy: Enemy,
  ): boolean {
    const strikePose = myriapoda.limbs.getStrikePose(limb, myriapoda.body);
    const enemyPositionPixels = vec2ToPixels(enemy.body.getPosition());

    return isCircleInStrikeCone(
      strikePose.tipPixels,
      strikePose.direction,
      enemyPositionPixels,
      enemy.radiusPx,
      tuning.limbAttackConeRangePx,
      tuning.limbAttackConeHalfAngle,
    );
  }

}
