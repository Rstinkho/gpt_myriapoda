import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { BodyChain } from '@/entities/myriapoda/BodyChain';
import {
  createIdleLimbState,
  getLimbStateProgress,
  stepLimbState,
  type LimbState,
} from '@/entities/myriapoda/limbState';
import { LimbChainBody } from '@/physics/bodies/LimbChain';
import { pixelsToMeters } from '@/physics/PhysicsUtils';
import { clamp, lerp, normalize } from '@/utils/math';

export interface LimbRuntime {
  id: string;
  body: LimbChainBody;
  anchorRatio: number;
  mountOffsetPx: number;
  side: -1 | 1;
  phase: number;
  state: LimbState;
  desiredTarget: { x: number; y: number } | null;
}

export interface LimbStrikePose {
  rootPixels: { x: number; y: number };
  tipPixels: { x: number; y: number };
  direction: { x: number; y: number };
}

export class LimbController {
  readonly limbs: LimbRuntime[];
  private elapsed = 0;

  constructor(world: planck.World, bodyChain: BodyChain) {
    const limbMounts = [
      { anchorRatio: 0, side: -1 as const, phase: 0.1 },
      { anchorRatio: 0, side: 1 as const, phase: 0.38 },
      { anchorRatio: 1, side: -1 as const, phase: 0.64 },
      { anchorRatio: 1, side: 1 as const, phase: 0.92 },
    ];
    this.limbs = limbMounts.map(({ anchorRatio, side, phase }, index) => {
      const segment = bodyChain.sampleAlongBody(anchorRatio);
      const mountOffsetPx = Math.max(4.5, segment.radius * 0.8);
      const tangent = {
        x: Math.cos(segment.angle),
        y: Math.sin(segment.angle),
      };
      const normal = {
        x: -tangent.y * side,
        y: tangent.x * side,
      };
      const anchor = {
        x: segment.x + normal.x * mountOffsetPx,
        y: segment.y + normal.y * mountOffsetPx,
      };
      const limbId = `limb-${index + 1}`;

      return {
        id: limbId,
        body: new LimbChainBody(world, limbId, anchor, normal),
        anchorRatio,
        mountOffsetPx,
        side,
        phase,
        state: createIdleLimbState(),
        desiredTarget: null,
      };
    });
  }

  setTarget(limbId: string, targetId: string | null, targetPosition: { x: number; y: number } | null): void {
    const limb = this.limbs.find((candidate) => candidate.id === limbId);
    if (!limb) {
      return;
    }

    limb.state.targetId = targetId;
    limb.desiredTarget = targetPosition;
  }

  releaseAttack(limbId: string): void {
    const limb = this.limbs.find((candidate) => candidate.id === limbId);
    if (!limb) {
      return;
    }

    limb.desiredTarget = null;
    limb.state = {
      name: 'retract',
      timer: tuning.limbRetractSeconds,
      duration: tuning.limbRetractSeconds,
      targetId: null,
    };
  }

  update(deltaSeconds: number, hitLimbIds: Set<string>, bodyChain: BodyChain): void {
    this.elapsed += deltaSeconds;
    for (const limb of this.limbs) {
      limb.state = stepLimbState(
        limb.state,
        deltaSeconds,
        tuning.limbCooldownSeconds,
        limb.desiredTarget !== null,
        hitLimbIds.has(limb.id),
      );

      this.applyForces(limb, bodyChain);
      if (limb.state.name === 'idle') {
        limb.desiredTarget = null;
      }
    }
  }

  isLimbReady(limb: LimbRuntime, bodyChain: BodyChain): boolean {
    return limb.state.name === 'idle' && limb.state.timer === 0 && limb.desiredTarget === null;
  }

  getStrikePose(limb: LimbRuntime, bodyChain: BodyChain): LimbStrikePose {
    const segment = bodyChain.sampleAlongBody(limb.anchorRatio);
    const tangent = {
      x: Math.cos(segment.angle),
      y: Math.sin(segment.angle),
    };
    const normal = {
      x: -tangent.y * limb.side,
      y: tangent.x * limb.side,
    };
    const rootPixels = {
      x: segment.x + normal.x * limb.mountOffsetPx,
      y: segment.y + normal.y * limb.mountOffsetPx,
    };
    const tipPixels = {
      x: rootPixels.x + normal.x * (segment.radius + tuning.limbRestReachPx),
      y: rootPixels.y + normal.y * (segment.radius + tuning.limbRestReachPx),
    };

    return {
      rootPixels,
      tipPixels,
      direction: normalize(tipPixels.x - rootPixels.x, tipPixels.y - rootPixels.y),
    };
  }

  private applyForces(limb: LimbRuntime, bodyChain: BodyChain): void {
    const { segment, tangent, normal, rootPixels, idleTargetPixels, controlPixels: homeControlPixels } =
      this.getIdleTargets(limb, bodyChain);
    const stateProgress = getLimbStateProgress(limb.state);
    const extensionWeight =
      limb.state.name === 'extend'
        ? this.easeOutCubic(stateProgress)
        : limb.state.name === 'hit'
          ? 1
          : limb.state.name === 'retract'
            ? 1 - this.easeInOutSine(stateProgress)
            : 0;

    let desiredPixels = idleTargetPixels;
    let controlPixels = homeControlPixels;

    if (limb.desiredTarget && extensionWeight > 0) {
      const attackDirection = normalize(
        limb.desiredTarget.x - rootPixels.x,
        limb.desiredTarget.y - rootPixels.y,
      );
      const distanceToTarget = Math.hypot(
        limb.desiredTarget.x - rootPixels.x,
        limb.desiredTarget.y - rootPixels.y,
      );
      const minAttackReach = segment.radius + tuning.limbRestReachPx + tuning.limbAttackExtendPx;
      const maxAttackReach =
        segment.radius + tuning.limbRestReachPx + tuning.limbAttackConeRangePx;
      const attackReach = Math.min(
        maxAttackReach,
        Math.max(minAttackReach, distanceToTarget),
      );
      const fullAttackPixels = {
        x: rootPixels.x + attackDirection.x * attackReach,
        y: rootPixels.y + attackDirection.y * attackReach,
      };
      const whipNormal = {
        x: -attackDirection.y * limb.side,
        y: attackDirection.x * limb.side,
      };
      const whipCurve = tuning.limbWhipCurvePx * Math.sin(extensionWeight * Math.PI);
      desiredPixels = {
        x: lerp(idleTargetPixels.x, fullAttackPixels.x, extensionWeight),
        y: lerp(idleTargetPixels.y, fullAttackPixels.y, extensionWeight),
      };
      controlPixels = {
        x:
          rootPixels.x +
          attackDirection.x * attackReach * lerp(0.36, 0.62, extensionWeight) +
          whipNormal.x * whipCurve,
        y:
          rootPixels.y +
          attackDirection.y * attackReach * lerp(0.36, 0.62, extensionWeight) +
          whipNormal.y * whipCurve,
      };
    }

    const root = {
      x: pixelsToMeters(rootPixels.x),
      y: pixelsToMeters(rootPixels.y),
    };
    const desired = {
      x: pixelsToMeters(desiredPixels.x),
      y: pixelsToMeters(desiredPixels.y),
    };
    const control = {
      x: pixelsToMeters(controlPixels.x),
      y: pixelsToMeters(controlPixels.y),
    };
    const isRecovering =
      limb.desiredTarget === null &&
      (limb.state.name === 'retract' || this.isLimbAwayFromHome(limb, root, control, desired));

    const rootCurrent = limb.body.root.getPosition();
    const rootForceScale = isRecovering
      ? tuning.limbRecoveryPullBoost
      : clamp(0.74 + extensionWeight * 0.3, 0.7, 1.1);
    limb.body.root.applyForceToCenter(
      planck.Vec2(
        (root.x - rootCurrent.x) * tuning.limbRootPull * rootForceScale,
        (root.y - rootCurrent.y) * tuning.limbRootPull * rootForceScale,
      ),
      true,
    );

    limb.body.bodies.forEach((body, index) => {
      const t = (index + 1) / limb.body.bodies.length;
      const target = this.sampleQuadratic(root, control, desired, t);
      const current = body.getPosition();
      const chainForceScale = isRecovering
        ? tuning.limbRecoveryPullBoost
        : clamp(0.66 + extensionWeight * 0.34, 0.64, 1.08);
      body.applyForceToCenter(
        planck.Vec2(
          (target.x - current.x) * tuning.limbChainPull * chainForceScale,
          (target.y - current.y) * tuning.limbChainPull * chainForceScale,
        ),
        true,
      );
    });
  }

  private getIdleTargets(
    limb: LimbRuntime,
    bodyChain: BodyChain,
  ): {
    segment: ReturnType<BodyChain['sampleAlongBody']>;
    tangent: { x: number; y: number };
    normal: { x: number; y: number };
    rootPixels: { x: number; y: number };
    idleTargetPixels: { x: number; y: number };
    controlPixels: { x: number; y: number };
  } {
    const segment = bodyChain.sampleAlongBody(limb.anchorRatio);
    const tangent = {
      x: Math.cos(segment.angle),
      y: Math.sin(segment.angle),
    };
    const normal = {
      x: -tangent.y * limb.side,
      y: tangent.x * limb.side,
    };
    const rootPixels = {
      x: segment.x + normal.x * limb.mountOffsetPx,
      y: segment.y + normal.y * limb.mountOffsetPx,
    };
    const sway = Math.sin(this.elapsed * 4 + limb.phase + limb.anchorRatio * 3.2) * tuning.limbSwayPx;
    const idleTargetPixels = {
      x:
        rootPixels.x +
        normal.x * (segment.radius + tuning.limbRestReachPx) +
        tangent.x * sway * 0.45,
      y:
        rootPixels.y +
        normal.y * (segment.radius + tuning.limbRestReachPx) +
        tangent.y * sway * 0.45,
    };
    const controlPixels = {
      x:
        rootPixels.x +
        normal.x * (segment.radius + tuning.limbRestReachPx) * 0.6 +
        tangent.x * sway,
      y:
        rootPixels.y +
        normal.y * (segment.radius + tuning.limbRestReachPx) * 0.6 +
        tangent.y * sway,
    };

    return {
      segment,
      tangent,
      normal,
      rootPixels,
      idleTargetPixels,
      controlPixels,
    };
  }

  private isLimbAwayFromHome(
    limb: LimbRuntime,
    root: { x: number; y: number },
    control: { x: number; y: number },
    desired: { x: number; y: number },
  ): boolean {
    const settleDistance = pixelsToMeters(tuning.limbHomeSnapDistancePx * 1.6);
    if (this.isBodyAwayFromTarget(limb.body.root, root, settleDistance)) {
      return true;
    }

    return limb.body.bodies.some((body, index) => {
      const t = (index + 1) / limb.body.bodies.length;
      const target = this.sampleQuadratic(root, control, desired, t);
      return this.isBodyAwayFromTarget(body, target, settleDistance);
    });
  }

  private isBodyAwayFromTarget(
    body: planck.Body,
    target: { x: number; y: number },
    threshold: number,
  ): boolean {
    const current = body.getPosition();
    return Math.hypot(current.x - target.x, current.y - target.y) > threshold;
  }

  private sampleQuadratic(
    start: { x: number; y: number },
    control: { x: number; y: number },
    end: { x: number; y: number },
    t: number,
  ): { x: number; y: number } {
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  }

  private easeOutCubic(value: number): number {
    const clamped = clamp(value, 0, 1);
    return 1 - (1 - clamped) ** 3;
  }

  private easeInOutSine(value: number): number {
    const clamped = clamp(value, 0, 1);
    return -(Math.cos(Math.PI * clamped) - 1) * 0.5;
  }
}
