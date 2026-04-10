import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { CollisionRegistry } from '@/physics/CollisionRegistry';

export class PhysicsWorld {
  readonly world: planck.World;

  constructor(private readonly collisions: CollisionRegistry) {
    this.world = new planck.World({
      gravity: planck.Vec2(0, 0),
    });
    this.collisions.bind(this.world);
  }

  step(): void {
    this.world.step(tuning.fixedStepSeconds);
  }
}
