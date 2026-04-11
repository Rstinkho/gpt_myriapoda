import { tuning } from '@/game/tuning';
import * as planck from 'planck';
import type { FixtureMeta } from '@/game/types';
import { pixelsToMeters, vec2FromPixels } from '@/physics/PhysicsUtils';

export class EnemyBody {
  readonly body: planck.Body;

  constructor(
    world: planck.World,
    id: string,
    x: number,
    y: number,
    radius: number,
    linearDamping: number = tuning.jellyfishLinearDamping,
    angularDamping: number = tuning.jellyfishAngularDamping,
  ) {
    this.body = world.createBody({
      type: 'dynamic',
      position: vec2FromPixels(x, y),
      linearDamping,
      angularDamping,
    });

    const fixture = this.body.createFixture({
      shape: planck.Circle(pixelsToMeters(radius)),
      density: 1.6,
      friction: 0.3,
      restitution: 0.08,
    });
    fixture.setUserData({
      tag: 'enemy-body',
      entityId: id,
    } satisfies FixtureMeta);
  }
}
