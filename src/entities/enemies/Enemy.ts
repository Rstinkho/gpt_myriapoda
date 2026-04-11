import type * as planck from 'planck';
import type { EnemyType } from '@/game/types';

export interface EnemyBase {
  id: string;
  type: EnemyType;
  body: planck.Body;
  health: number;
  radiusPx: number;
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

export type Enemy = JellyfishEnemyState | LeechEnemyState;

export function isLeechEnemy(enemy: Enemy): enemy is LeechEnemyState {
  return enemy.type === 'leech';
}

export function isLatchedLeech(enemy: Enemy): enemy is LeechEnemyState {
  return enemy.type === 'leech' && enemy.state === 'latched';
}
