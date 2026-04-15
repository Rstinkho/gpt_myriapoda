import { tuning } from '@/game/tuning';
import type {
  HexCell,
  ShellbackAttackState,
  ShellbackClawSide,
  ShellbackShellState,
} from '@/game/types';
import { createCoordKey } from '@/entities/world/WorldExpansion';
import { clamp } from '@/utils/math';

export interface ShellbackSteering {
  forceX: number;
  forceY: number;
}

export interface ShellbackRuntimeState {
  shellState: ShellbackShellState;
  shellTimer: number;
  attackState: ShellbackAttackState;
  attackTimer: number;
  attackTarget: { x: number; y: number } | null;
  activeClaw: ShellbackClawSide;
}

export interface StepShellbackStateOptions {
  deltaSeconds: number;
  hasAggro: boolean;
  strikeTarget: { x: number; y: number } | null;
}

export interface StepShellbackStateResult extends ShellbackRuntimeState {
  didStrike: boolean;
  isVulnerable: boolean;
}

export function getShellbackPhaseSeed(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 360) * (Math.PI / 180);
}

export function pickShellbackGuardCell(
  cells: HexCell[],
  claimedGuardCellKeys: ReadonlySet<string>,
  randomFloat: () => number = Math.random,
): HexCell | null {
  const preferredCells = cells.filter((cell) => cell.type === 'enriched');
  if (preferredCells.length === 0) {
    return null;
  }
  const unclaimed = preferredCells.filter(
    (cell) => !claimedGuardCellKeys.has(createCoordKey(cell.coord)),
  );
  const pool = unclaimed.length > 0 ? unclaimed : preferredCells;
  const index = Math.max(0, Math.min(pool.length - 1, Math.floor(randomFloat() * pool.length)));
  return pool[index] ?? null;
}

export function isWithinShellbackAggroRadius(
  point: { x: number; y: number },
  guardCenter: { x: number; y: number },
  radiusPx: number = tuning.shellbackAggroRadiusPx,
): boolean {
  return (
    Math.hypot(point.x - guardCenter.x, point.y - guardCenter.y) <= radiusPx
  );
}

export function clampPointToRadius(
  point: { x: number; y: number },
  center: { x: number; y: number },
  radiusPx: number,
): { x: number; y: number } {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radiusPx || distance <= 0.0001) {
    return point;
  }

  const scale = radiusPx / distance;
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

export function createShellbackPatrolPoint(
  guardCenter: { x: number; y: number },
  elapsedSeconds: number,
  phaseSeed: number,
  orbitRadiusPx: number = tuning.shellbackGuardOrbitRadiusPx,
): { x: number; y: number } {
  const orbitAngle = elapsedSeconds * 0.7 + phaseSeed;
  const wobble = Math.sin(elapsedSeconds * 1.9 + phaseSeed * 0.6) * orbitRadiusPx * 0.22;
  return {
    x: guardCenter.x + Math.cos(orbitAngle) * (orbitRadiusPx + wobble),
    y: guardCenter.y + Math.sin(orbitAngle * 1.15) * (orbitRadiusPx * 0.68),
  };
}

export function createShellbackSteering(
  source: { x: number; y: number },
  target: { x: number; y: number },
  strength: number,
  elapsedSeconds: number,
  phaseSeed: number,
): ShellbackSteering {
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
  const gait = Math.sin(elapsedSeconds * 6.8 + phaseSeed) * 0.24;
  const drift = Math.cos(elapsedSeconds * 3.4 + phaseSeed * 0.7) * 0.08;

  return {
    forceX: direction.x * strength + normal.x * strength * gait + direction.x * strength * drift,
    forceY: direction.y * strength + normal.y * strength * gait + direction.y * strength * drift,
  };
}

export function getShellbackClawOrigin(
  bodyPosition: { x: number; y: number },
  angle: number,
  side: ShellbackClawSide,
): { x: number; y: number } {
  const sideSign = side === 'left' ? -1 : 1;
  const local = {
    x: tuning.shellbackDisplaySize * 0.26,
    y: tuning.shellbackDisplaySize * 0.23 * sideSign,
  };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: bodyPosition.x + local.x * cos - local.y * sin,
    y: bodyPosition.y + local.x * sin + local.y * cos,
  };
}

export function getShellbackShellOpenFactor(
  shellState: ShellbackShellState,
  shellTimer: number,
): number {
  const transitionWindow = 0.22;
  if (shellState === 'exposed') {
    const elapsed = tuning.shellbackExposedSeconds - shellTimer;
    return clamp(elapsed / transitionWindow, 0, 1);
  }

  const elapsed = tuning.shellbackShelledSeconds - shellTimer;
  return 1 - clamp(elapsed / transitionWindow, 0, 1);
}

export function getShellbackAttackWeight(
  attackState: ShellbackAttackState,
  attackTimer: number,
): number {
  switch (attackState) {
    case 'windup':
      return 0.2 + 0.8 * (1 - attackTimer / Math.max(0.0001, tuning.shellbackWindupSeconds));
    case 'strike':
      return 1;
    case 'recover':
      return clamp(attackTimer / Math.max(0.0001, tuning.shellbackRecoverSeconds), 0, 1);
    default:
      return 0;
  }
}

export function stepShellbackState(
  current: ShellbackRuntimeState,
  options: StepShellbackStateOptions,
): StepShellbackStateResult {
  let next: StepShellbackStateResult = {
    ...current,
    shellTimer: Math.max(0, current.shellTimer - options.deltaSeconds),
    attackTimer: Math.max(0, current.attackTimer - options.deltaSeconds),
    didStrike: false,
    isVulnerable: current.shellState === 'exposed',
  };

  if (current.shellState === 'exposed' && next.shellTimer === 0) {
    next = {
      ...next,
      shellState: 'shelled',
      shellTimer: tuning.shellbackShelledSeconds,
      attackState: 'idle',
      attackTimer: 0,
      attackTarget: null,
      isVulnerable: false,
    };
  } else if (current.shellState === 'shelled' && next.shellTimer === 0) {
    next = {
      ...next,
      shellState: 'exposed',
      shellTimer: tuning.shellbackExposedSeconds,
      isVulnerable: true,
    };
  }

  if (next.shellState === 'shelled') {
    return {
      ...next,
      attackState: 'idle',
      attackTimer: 0,
      attackTarget: null,
      isVulnerable: false,
    };
  }

  switch (current.attackState) {
    case 'idle':
      next.attackTarget = null;
      if (
        next.attackTimer === 0 &&
        options.hasAggro &&
        options.strikeTarget
      ) {
        next.attackState = 'windup';
        next.attackTimer = tuning.shellbackWindupSeconds;
        next.attackTarget = options.strikeTarget;
      }
      break;

    case 'windup':
      next.attackTarget = options.strikeTarget ?? current.attackTarget;
      if (next.attackTimer === 0) {
        next.attackState = 'strike';
        next.attackTimer = tuning.shellbackStrikeSeconds;
        next.didStrike = true;
      }
      break;

    case 'strike':
      next.attackTarget = current.attackTarget;
      if (next.attackTimer === 0) {
        next.attackState = 'recover';
        next.attackTimer = tuning.shellbackRecoverSeconds;
      }
      break;

    case 'recover':
      next.attackTarget = current.attackTarget;
      if (next.attackTimer === 0) {
        next.attackState = 'idle';
        next.attackTimer = tuning.shellbackAttackCooldownSeconds;
        next.attackTarget = null;
        next.activeClaw = current.activeClaw === 'left' ? 'right' : 'left';
      }
      break;
  }

  return {
    ...next,
    isVulnerable: next.shellState === 'exposed',
  };
}
