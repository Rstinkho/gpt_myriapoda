import Phaser from 'phaser';
import * as planck from 'planck';
import type { PickupResourceId, PickupTier } from '@/game/types';
import {
  getPickupDefinition,
  type PickupDefinition,
} from '@/entities/pickups/PickupRegistry';
import {
  applyPickupSpriteAnimation,
  getPickupAnimationPhase,
} from '@/entities/pickups/PickupVisuals';
import { sampleParasiteWorldLifecycle } from '@/entities/pickups/harmful/parasite/parasiteLifecycle';
import { pixelsToMeters, vec2FromPixels } from '@/physics/PhysicsUtils';

export interface PickupOptions {
  impulse?: { x: number; y: number };
  scale?: number;
  alpha?: number;
}

export class Pickup {
  readonly definition: PickupDefinition;
  readonly sprite: Phaser.GameObjects.Image;
  readonly body: planck.Body;
  readonly tier: PickupTier;
  readonly resourceId: PickupResourceId;
  readonly scale: number;
  private readonly animationPhase: number;
  private readonly baseWidth: number;
  private readonly baseHeight: number;
  private readonly baseAlpha: number;
  private ageSeconds = 0;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    resourceId: PickupResourceId,
    x: number,
    y: number,
    options: PickupOptions = {},
  ) {
    this.resourceId = resourceId;
    this.definition = getPickupDefinition(resourceId);
    this.tier = this.definition.tier;
    this.scale = options.scale ?? 1;
    this.animationPhase = getPickupAnimationPhase(id);
    this.sprite = scene.add.image(x, y, this.definition.textureKey);
    this.baseWidth = this.definition.radius * 2.4 * this.scale;
    this.baseHeight = this.definition.radius * 2.4 * this.scale;
    this.baseAlpha = options.alpha ?? 0.92;
    this.sprite.setDisplaySize(this.baseWidth, this.baseHeight);
    this.sprite.setAlpha(this.baseAlpha);
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

  stepWorldLifecycle(deltaSeconds: number): boolean {
    if (!this.definition.worldLifetimeSeconds) {
      return false;
    }

    this.ageSeconds += deltaSeconds;
    return this.ageSeconds >= this.definition.worldLifetimeSeconds;
  }

  updateVisual(elapsedSeconds: number): void {
    applyPickupSpriteAnimation(
      this.sprite,
      this.baseWidth,
      this.baseHeight,
      this.baseAlpha,
      this.body.getAngle(),
      this.definition.palette,
      this.definition.animationProfile,
      elapsedSeconds,
      this.animationPhase,
    );

    if (
      this.resourceId === 'parasite' &&
      this.definition.worldLifetimeSeconds &&
      this.definition.despawnAnimationSeconds
    ) {
      const lifecycle = sampleParasiteWorldLifecycle(
        this.ageSeconds,
        this.definition.worldLifetimeSeconds,
        this.definition.despawnAnimationSeconds,
      );
      this.sprite.setDisplaySize(
        this.sprite.displayWidth * lifecycle.scaleXMultiplier,
        this.sprite.displayHeight * lifecycle.scaleYMultiplier,
      );
      this.sprite.setAlpha(this.sprite.alpha * lifecycle.alphaMultiplier);
    }
  }

  destroy(world: planck.World): void {
    world.destroyBody(this.body);
    this.sprite.destroy();
  }
}
