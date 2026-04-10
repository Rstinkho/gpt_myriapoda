import { tuning } from '@/game/tuning';

export type LimbStateName = 'idle' | 'extend' | 'hit' | 'retract';

export interface LimbState {
  name: LimbStateName;
  timer: number;
  duration: number;
  targetId: string | null;
}

export function createIdleLimbState(): LimbState {
  return { name: 'idle', timer: 0, duration: 0, targetId: null };
}

export function getLimbStateProgress(state: LimbState): number {
  if (state.duration <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, 1 - state.timer / state.duration));
}

export function stepLimbState(
  state: LimbState,
  deltaSeconds: number,
  cooldownSeconds: number,
  hasTarget: boolean,
  landedHit: boolean,
): LimbState {
  const timer = Math.max(0, state.timer - deltaSeconds);

  if (state.name === 'idle') {
    if (timer === 0 && hasTarget) {
      return {
        name: 'extend',
        timer: tuning.limbExtendSeconds,
        duration: tuning.limbExtendSeconds,
        targetId: state.targetId,
      };
    }
    return { ...state, timer };
  }

  if (state.name === 'extend') {
    if (landedHit) {
      return {
        name: 'hit',
        timer: tuning.limbHitSeconds,
        duration: tuning.limbHitSeconds,
        targetId: state.targetId,
      };
    }
    if (timer === 0) {
      return {
        name: 'retract',
        timer: tuning.limbRetractSeconds,
        duration: tuning.limbRetractSeconds,
        targetId: state.targetId,
      };
    }
    return { ...state, timer };
  }

  if (state.name === 'hit') {
    return timer === 0
      ? {
          name: 'retract',
          timer: tuning.limbRetractSeconds,
          duration: tuning.limbRetractSeconds,
          targetId: state.targetId,
        }
      : { ...state, timer };
  }

  return timer === 0
    ? { name: 'idle', timer: cooldownSeconds, duration: cooldownSeconds, targetId: null }
    : { ...state, timer };
}
