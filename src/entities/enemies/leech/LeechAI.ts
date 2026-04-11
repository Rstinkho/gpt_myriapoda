import { tuning } from '@/game/tuning';
import type { LeechState } from '@/entities/enemies/Enemy';

export interface LeechSteering {
  forceX: number;
  forceY: number;
}

export interface LeechRuntimeState {
  state: LeechState;
  attachedLatchSlotIndex: number | null;
  drainTimer: number;
  detachProgress: number;
  recoveryTimer: number;
}

export interface StepLeechStateOptions {
  deltaSeconds: number;
  stomachHasStoredParticles: boolean;
  canLatch: boolean;
  withinLatchDistance: boolean;
  headSpeedRatio: number;
  dashShakeStrength: number;
}

export interface StepLeechStateResult extends LeechRuntimeState {
  didLatch: boolean;
  didDetach: boolean;
  shouldConsumeParticle: boolean;
}

export function getLeechPhaseSeed(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 360) * (Math.PI / 180);
}

export function createLeechSteering(
  source: { x: number; y: number },
  target: { x: number; y: number },
  strength: number,
  elapsedSeconds: number,
  phaseSeed: number,
): LeechSteering {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const direction = {
    x: dx / distance,
    y: dy / distance,
  };
  const normal = {
    x: -direction.y,
    y: direction.x,
  };
  const sCurve = Math.sin(elapsedSeconds * 6.1 + phaseSeed) * 0.34;
  const settle = Math.max(0.36, Math.min(1, distance / 1.2));

  return {
    forceX: direction.x * strength + normal.x * strength * sCurve * settle,
    forceY: direction.y * strength + normal.y * strength * sCurve * settle,
  };
}

export function pickLeechLatchSlot(
  occupiedSlotIndices: ReadonlySet<number>,
  slotCount: number = tuning.leechLatchSlotCount,
): number | null {
  for (let index = 0; index < slotCount; index += 1) {
    if (!occupiedSlotIndices.has(index)) {
      return index;
    }
  }

  return null;
}

export function isWithinLeechLatchDistance(
  sourcePixels: { x: number; y: number },
  targetPixels: { x: number; y: number },
  latchDistancePx: number = tuning.leechLatchDistancePx,
): boolean {
  return (
    Math.hypot(
      targetPixels.x - sourcePixels.x,
      targetPixels.y - sourcePixels.y,
    ) <= latchDistancePx
  );
}

export function advanceLeechDetachProgress(
  currentProgress: number,
  headSpeedRatio: number,
  dashShakeStrength: number,
  deltaSeconds: number,
): number {
  const moveRatio = Math.max(
    0,
    (headSpeedRatio - tuning.leechDetachMoveSpeedThreshold) /
      Math.max(0.0001, 1 - tuning.leechDetachMoveSpeedThreshold),
  );
  const moveGain = moveRatio * tuning.leechDetachMoveRate * deltaSeconds;
  const dashGain =
    tuning.dashShakeSeconds <= 0
      ? 0
      : (dashShakeStrength * tuning.leechDetachDashImpulse * deltaSeconds) /
        tuning.dashShakeSeconds;

  return currentProgress + moveGain + dashGain;
}

export function stepLeechState(
  current: LeechRuntimeState,
  options: StepLeechStateOptions,
): StepLeechStateResult {
  let next: StepLeechStateResult = {
    ...current,
    didLatch: false,
    didDetach: false,
    shouldConsumeParticle: false,
  };

  switch (current.state) {
    case 'seeking':
      if (options.canLatch && options.withinLatchDistance) {
        next = {
          ...next,
          state: 'latched',
          drainTimer: tuning.leechDrainIntervalSeconds,
          detachProgress: 0,
          didLatch: true,
        };
      }
      break;

    case 'latched': {
      const detachProgress = advanceLeechDetachProgress(
        current.detachProgress,
        options.headSpeedRatio,
        options.dashShakeStrength,
        options.deltaSeconds,
      );

      if (detachProgress >= tuning.leechDetachThreshold) {
        next = {
          ...next,
          state: 'detached',
          attachedLatchSlotIndex: null,
          detachProgress: 0,
          drainTimer: 0,
          recoveryTimer: tuning.leechDetachRecoverySeconds,
          didDetach: true,
        };
        break;
      }

      if (!options.stomachHasStoredParticles) {
        next = {
          ...next,
          state: 'drainedOut',
          detachProgress,
          drainTimer: 0,
          recoveryTimer: tuning.leechDrainOutSeconds,
        };
        break;
      }

      const nextDrainTimer = current.drainTimer - options.deltaSeconds;
      next = {
        ...next,
        detachProgress,
        drainTimer: nextDrainTimer,
      };
      if (nextDrainTimer <= 0) {
        next.shouldConsumeParticle = true;
        next.drainTimer =
          nextDrainTimer + Math.max(0.0001, tuning.leechDrainIntervalSeconds);
      }
      break;
    }

    case 'drainedOut': {
      const recoveryTimer = Math.max(0, current.recoveryTimer - options.deltaSeconds);
      if (recoveryTimer === 0) {
        next = {
          ...next,
          state: 'detached',
          attachedLatchSlotIndex: null,
          detachProgress: 0,
          drainTimer: 0,
          recoveryTimer: tuning.leechDetachRecoverySeconds,
          didDetach: true,
        };
      } else {
        next = {
          ...next,
          recoveryTimer,
        };
      }
      break;
    }

    case 'detached': {
      const recoveryTimer = Math.max(0, current.recoveryTimer - options.deltaSeconds);
      next = {
        ...next,
        recoveryTimer,
        detachProgress: 0,
      };
      if (recoveryTimer === 0) {
        next.state = 'seeking';
      }
      break;
    }
  }

  return next;
}
