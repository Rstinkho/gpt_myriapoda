import type { EnemyType, PickupResourceId } from '@/game/types';

export function resolveEnemyDrops(
  enemyType: EnemyType,
  roll: number = Math.random(),
): PickupResourceId[] {
  switch (enemyType) {
    case 'jellyfish':
      return roll < 0.1
        ? ['biomass', 'biomass', 'tissue']
        : ['biomass', 'biomass', 'biomass'];
    case 'leech':
      return roll < 0.2 ? ['biomass'] : [];
    case 'shellback':
      return ['tissue', 'tissue'];
  }

  throw new Error(`Unsupported enemy drop type: ${String(enemyType)}`);
}
