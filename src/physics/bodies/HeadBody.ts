import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { FixtureMeta } from '@/game/types';
import { pixelsToMeters, vec2FromPixels } from '@/physics/PhysicsUtils';
import { attachSensor } from '@/physics/bodies/Sensor';

export class HeadBody {
  readonly body: planck.Body;

  constructor(world: planck.World, id: string, x: number, y: number) {
    this.body = world.createBody({
      type: 'dynamic',
      position: vec2FromPixels(x, y),
      linearDamping: tuning.headLinearDamping,
      angularDamping: tuning.headAngularDamping,
    });

    const solidFixture = this.body.createFixture({
      shape: planck.Circle(pixelsToMeters(tuning.headRadius)),
      density: 4,
      friction: 0.45,
      restitution: 0.05,
    });
    solidFixture.setUserData({
      tag: 'head-body',
      entityId: id,
    } satisfies FixtureMeta);

    attachSensor(
      this.body,
      planck.Circle(pixelsToMeters(tuning.vacuumConeLength)),
      {
        tag: 'head-vacuum',
        entityId: id,
      },
    );

    attachSensor(
      this.body,
      planck.Circle(pixelsToMeters(tuning.headThreatRadius)),
      {
        tag: 'head-threat',
        entityId: id,
      },
    );
  }
}
