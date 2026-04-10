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
  }
}
