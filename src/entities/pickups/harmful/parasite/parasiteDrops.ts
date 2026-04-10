import type { PickupResourceId } from '@/game/types';

export function appendParasiteBonusDrop(
  drops: readonly PickupResourceId[],
  roll: number,
  parasiteChance = 0.15,
): PickupResourceId[] {
  return roll < parasiteChance ? [...drops, 'parasite'] : [...drops];
}
