import type * as Phaser from 'phaser';
import { tuning } from '@/game/tuning';
import { GameEvents } from '@/game/events';
import type { LimbRuntime } from '@/entities/myriapoda/LimbController';
import type { Myriapoda } from '@/entities/myriapoda/Myriapoda';
import { vec2ToPixels } from '@/physics/PhysicsUtils';

export type PlayerDamageRegion =
  | {
      type: 'stomach';
      x: number;
      y: number;
      radius: number;
    }
  | {
      type: 'segment';
      index: number;
      x: number;
      y: number;
      radius: number;
    };

export type PlayerDamageResult =
  | {
      kind: 'none';
    }
  | {
      kind: 'stomach';
      removedMaterials: number;
      targetX: number;
      targetY: number;
    }
  | {
      kind: 'limb';
      limbId: string;
      segmentIndex: number;
      targetX: number;
      targetY: number;
    }
  | {
      kind: 'segment';
      segmentIndex: number;
      targetX: number;
      targetY: number;
    };

type EventBusLike = Pick<Phaser.Events.EventEmitter, 'emit'>;

export function collectPlayerDamageRegions(myriapoda: Myriapoda): PlayerDamageRegion[] {
  const stomachAnchor = myriapoda.body.getStomachAnchor();
  const stomachIndex = myriapoda.body.getStomachSegmentIndex();
  const stomachRadius = tuning.stomachRadiusMeters * tuning.pixelsPerMeter;
  const regions: PlayerDamageRegion[] = [
    {
      type: 'stomach',
      x: stomachAnchor.x,
      y: stomachAnchor.y,
      radius: stomachRadius,
    },
  ];

  for (let index = 0; index < myriapoda.body.segments.length; index += 1) {
    if (index === stomachIndex) {
      continue;
    }

    const segment = myriapoda.body.segments[index];
    regions.push({
      type: 'segment',
      index,
      x: segment.x,
      y: segment.y,
      radius: segment.radius * tuning.myriapodaBodyCircleScale,
    });
  }

  return regions;
}

export function findNearestPlayerDamageRegion(
  regions: ReadonlyArray<PlayerDamageRegion>,
  origin: { x: number; y: number },
  maxReachPx: number = tuning.shellbackClawReachPx,
): PlayerDamageRegion | null {
  let bestRegion: PlayerDamageRegion | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const region of regions) {
    const centerDistance = Math.hypot(region.x - origin.x, region.y - origin.y);
    const edgeDistance = Math.max(0, centerDistance - region.radius);
    if (edgeDistance > maxReachPx) {
      continue;
    }
    if (edgeDistance < bestDistance) {
      bestDistance = edgeDistance;
      bestRegion = region;
    }
  }

  return bestRegion;
}

function getLimbRootPixels(limb: LimbRuntime): { x: number; y: number } {
  if (!limb.body) {
    return { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
  }

  return vec2ToPixels(limb.body.root.getPosition());
}

export class PlayerDamageSystem {
  constructor(private readonly eventBus: EventBusLike) {}

  findShellbackStrikeTarget(
    myriapoda: Myriapoda,
    clawOrigin: { x: number; y: number },
  ): PlayerDamageRegion | null {
    const target = findNearestPlayerDamageRegion(
      collectPlayerDamageRegions(myriapoda),
      clawOrigin,
      tuning.shellbackClawReachPx,
    );
    if (!target || target.type === 'stomach') {
      return target;
    }

    const attachedLimbs = myriapoda.limbs.getActiveLimbsAttachedToSegment(
      target.index,
      myriapoda.body,
    );
    if (attachedLimbs.length === 0) {
      return target;
    }

    attachedLimbs.sort((left, right) => {
      const leftRoot = getLimbRootPixels(left);
      const rightRoot = getLimbRootPixels(right);
      const leftDistance = Math.hypot(leftRoot.x - clawOrigin.x, leftRoot.y - clawOrigin.y);
      const rightDistance = Math.hypot(rightRoot.x - clawOrigin.x, rightRoot.y - clawOrigin.y);
      return leftDistance - rightDistance;
    });

    const limbRoot = getLimbRootPixels(attachedLimbs[0]);
    return {
      ...target,
      x: limbRoot.x,
      y: limbRoot.y,
      radius: Math.max(6, target.radius * 0.34),
    };
  }

  applyShellbackStrike(
    myriapoda: Myriapoda,
    clawOrigin: { x: number; y: number },
  ): PlayerDamageResult {
    const target = this.findShellbackStrikeTarget(myriapoda, clawOrigin);
    if (!target) {
      return { kind: 'none' };
    }

    if (target.type === 'stomach') {
      const removedMaterials = myriapoda.stomach.drainStoredParticles(
        tuning.shellbackStomachMaterialLoss,
      );
      myriapoda.flashStomachDamage();
      myriapoda.spawnStomachHitEffect(target.x, target.y);
      this.emitHitImpulse();
      return {
        kind: 'stomach',
        removedMaterials,
        targetX: target.x,
        targetY: target.y,
      };
    }

    const attachedLimbs = myriapoda.limbs.getActiveLimbsAttachedToSegment(
      target.index,
      myriapoda.body,
    );
    if (attachedLimbs.length > 0) {
      attachedLimbs.sort((left, right) => {
        const leftRoot = getLimbRootPixels(left);
        const rightRoot = getLimbRootPixels(right);
        const leftDistance = Math.hypot(leftRoot.x - clawOrigin.x, leftRoot.y - clawOrigin.y);
        const rightDistance = Math.hypot(rightRoot.x - clawOrigin.x, rightRoot.y - clawOrigin.y);
        return leftDistance - rightDistance;
      });
      const destroyedLimb = attachedLimbs[0];
      const limbRoot = getLimbRootPixels(destroyedLimb);
      myriapoda.flashSegmentDamage(target.index);
      myriapoda.spawnLimbLossEffect(limbRoot.x, limbRoot.y);
      myriapoda.limbs.destroyLimb(destroyedLimb.id);
      this.emitHitImpulse();
      return {
        kind: 'limb',
        limbId: destroyedLimb.id,
        segmentIndex: target.index,
        targetX: target.x,
        targetY: target.y,
      };
    }

    if (myriapoda.body.removeSegmentAt(target.index)) {
      this.emitHitImpulse();
      return {
        kind: 'segment',
        segmentIndex: target.index,
        targetX: target.x,
        targetY: target.y,
      };
    }

    return { kind: 'none' };
  }

  private emitHitImpulse(): void {
    this.eventBus.emit(GameEvents.cameraImpulse, {
      duration: 0.16,
      zoom: tuning.cameraHitZoom,
      shake: tuning.cameraHitShake * 1.1,
    });
  }
}
