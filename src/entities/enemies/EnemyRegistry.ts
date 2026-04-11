import type { EnemyType } from '@/game/types';

export function getLeechSpawnShare(stage: number): number {
  if (stage >= 4) {
    return 0.45;
  }

  if (stage === 3) {
    return 0.35;
  }

  if (stage === 2) {
    return 0.25;
  }

  return 0;
}

export function resolveEnemyType(
  stage: number = 1,
  roll: number = Math.random(),
): EnemyType {
  return roll < getLeechSpawnShare(stage) ? 'leech' : 'jellyfish';
}
