import Phaser from 'phaser';
import * as planck from 'planck';
import type { PickupType } from '@/game/types';
import { pickupDefinitions } from '@/entities/pickups/PickupTypes';
import { pixelsToMeters, vec2FromPixels } from '@/physics/PhysicsUtils';

export interface PickupOptions {
  impulse?: { x: number; y: number };
  scale?: number;
  alpha?: number;
}

export class Pickup {
  readonly definition;
  readonly sprite: Phaser.GameObjects.Image;
  readonly body: planck.Body;
  readonly scale: number;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    readonly type: PickupType,
    x: number,
    y: number,
    options: PickupOptions = {},
  ) {
    this.definition = pickupDefinitions[type];
    this.scale = options.scale ?? 1;
    this.sprite = scene.add.image(x, y, this.definition.textureKey);
    this.sprite.setDisplaySize(
      this.definition.radius * 2.4 * this.scale,
      this.definition.radius * 2.4 * this.scale,
    );
    this.sprite.setAlpha(options.alpha ?? 0.92);
    this.sprite.setDepth(6);

    this.body = world.createBody({
      type: 'dynamic',
      position: vec2FromPixels(x, y),
      linearDamping: 4.4,
      angularDamping: 7,
    });
    const fixture = this.body.createFixture({
      shape: planck.Circle(pixelsToMeters(this.definition.radius * this.scale)),
      density: 0.5,
      friction: 0.05,
      restitution: 0.05,
    });
    fixture.setUserData({
      tag: 'pickup-body',
      entityId: id,
    });

    if (options.impulse) {
      this.body.applyLinearImpulse(
        planck.Vec2(options.impulse.x, options.impulse.y),
        this.body.getWorldCenter(),
        true,
      );
    }
  }

  destroy(world: planck.World): void {
    world.destroyBody(this.body);
    this.sprite.destroy();
  }
}
