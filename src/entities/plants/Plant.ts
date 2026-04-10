import type * as planck from 'planck';
import type {
  PickupResourceId,
  PlantState,
  PlantType,
} from '@/game/types';

export interface Plant {
  id: string;
  type: PlantType;
  cellKey: string;
  state: PlantState;
  readonly harvestOutputs: readonly PickupResourceId[];
  isHarvestable(): boolean;
  beginChewing(): boolean;
  getDropOriginPixels(): { x: number; y: number };
  getVacuumPointPixels(): { x: number; y: number };
  getVacuumPointWorld(): planck.Vec2;
  applyVacuumForce(force: { x: number; y: number }): void;
  step(deltaSeconds: number): PickupResourceId[] | null;
  updateVisual(deltaSeconds: number): void;
  destroy(world: planck.World): void;
}
