import type * as planck from 'planck';
import type { EnemyType } from '@/game/types';

export interface Enemy {
  id: string;
  type: EnemyType;
  body: planck.Body;
  health: number;
  updateVisual(deltaSeconds: number): void;
  destroy(world: planck.World): void;
}
