import type * as planck from 'planck';
import type {
  EnemyType,
  ShellbackAttackState,
  ShellbackClawSide,
  ShellbackShellState,
} from '@/game/types';

export interface EnemyBase {
  id: string;
  type: EnemyType;
  body: planck.Body;
  health: number;
  radiusPx: number;
  speedMultiplier?: number;
  updateVisual(deltaSeconds: number): void;
  destroy(world: planck.World): void;
}

export interface JellyfishEnemyState extends EnemyBase {
  type: 'jellyfish';
}

export type LeechState = 'seeking' | 'latched' | 'drainedOut' | 'detached';

export interface LeechEnemyState extends EnemyBase {
  type: 'leech';
  state: LeechState;
  attachedLatchSlotIndex: number | null;
  drainTimer: number;
  detachProgress: number;
  recoveryTimer: number;
}

export interface ShellbackEnemyState extends EnemyBase {
  type: 'shellback';
  guardCellKey: string;
  guardCenterX: number;
  guardCenterY: number;
  shellState: ShellbackShellState;
  shellTimer: number;
  attackState: ShellbackAttackState;
  attackTimer: number;
  attackTarget: { x: number; y: number } | null;
  activeClaw: ShellbackClawSide;
  isVulnerable: boolean;
  phaseSeed: number;
}

export type Enemy = JellyfishEnemyState | LeechEnemyState | ShellbackEnemyState;

export function isLeechEnemy(enemy: Enemy): enemy is LeechEnemyState {
  return enemy.type === 'leech';
}

export function isLatchedLeech(enemy: Enemy): enemy is LeechEnemyState {
  return enemy.type === 'leech' && enemy.state === 'latched';
}

export function isShellbackEnemy(enemy: Enemy): enemy is ShellbackEnemyState {
  return enemy.type === 'shellback';
}
