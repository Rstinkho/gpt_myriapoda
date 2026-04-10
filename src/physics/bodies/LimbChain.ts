import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { FixtureMeta } from '@/game/types';
import { pixelsToMeters } from '@/physics/PhysicsUtils';

export class LimbChainBody {
  readonly bodies: planck.Body[] = [];
  readonly joints: planck.Joint[] = [];
  readonly root: planck.Body;
  readonly tip: planck.Body;

  constructor(
    world: planck.World,
    limbId: string,
    anchorPixels: { x: number; y: number },
    direction: { x: number; y: number },
  ) {
    const linkLength = pixelsToMeters(tuning.limbLinkLengthPx);
    const linkThickness = pixelsToMeters(tuning.limbThicknessPx);
    const origin = planck.Vec2(pixelsToMeters(anchorPixels.x), pixelsToMeters(anchorPixels.y));
    const dirLength = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const normalizedDirection = {
      x: direction.x / dirLength,
      y: direction.y / dirLength,
    };

    let previousBody: planck.Body | null = null;

    for (let index = 0; index < tuning.limbLinks; index += 1) {
      const spawnX = origin.x + normalizedDirection.x * linkLength * (index + 1);
      const spawnY = origin.y + normalizedDirection.y * linkLength * (index + 1);
      const body = world.createBody({
        type: 'dynamic',
        position: planck.Vec2(spawnX, spawnY),
        linearDamping: 8,
        angularDamping: 12,
      });

      const fixture = body.createFixture({
        shape: planck.Box(linkLength * 0.5, linkThickness * 0.5),
        density: 0.45,
        friction: 0.25,
      });
      fixture.setUserData({
        tag: index === tuning.limbLinks - 1 ? 'limb-tip' : 'limb-segment',
        entityId: `${limbId}-${index}`,
        ownerId: limbId,
      } satisfies FixtureMeta);

      if (previousBody) {
        const previousPosition = previousBody.getPosition();
        const joint = world.createJoint(
          planck.RevoluteJoint(
            {
              enableLimit: true,
              lowerAngle: -Math.PI / 1.35,
              upperAngle: Math.PI / 1.35,
            },
            previousBody,
            body,
            planck.Vec2(
              (previousPosition.x + body.getPosition().x) * 0.5,
              (previousPosition.y + body.getPosition().y) * 0.5,
            ),
          ),
        );

        if (joint) {
          this.joints.push(joint);
        }
      }
      this.bodies.push(body);
      previousBody = body;
    }

    this.root = this.bodies[0];
    this.tip = this.bodies[this.bodies.length - 1];
  }
}
