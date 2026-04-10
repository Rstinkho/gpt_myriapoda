import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type {
  PickupResourceId,
  PickupTier,
  UiStomachParasiteSnapshot,
} from '@/game/types';
import { getPickupDefinition } from '@/entities/pickups/PickupRegistry';
import {
  createActiveParasite,
  createParasiteAlertProgress,
  createUiParasiteSnapshots,
  stepActiveParasites,
  type ActiveParasite,
} from '@/entities/pickups/harmful/parasite';
import { randomBetween } from '@/utils/random';

export interface StomachParticle {
  id: string;
  body: planck.Body;
  digestValue: number;
  radiusMeters: number;
  resourceId: PickupResourceId;
  tier: PickupTier;
}

export class StomachSystem {
  private serial = 0;
  private parasiteSerial = 0;
  readonly world: planck.World;
  readonly particles: StomachParticle[] = [];
  readonly parasites: ActiveParasite[] = [];
  private readonly mixerBody: planck.Body;
  private anchorX = 0;
  private anchorY = 0;
  private mixTime = 0;
  biomass = 0;
  digestedTotal = 0;
  consumedPickupTotal = 0;

  constructor() {
    this.world = new planck.World({
      gravity: planck.Vec2(0, 0),
    });

    const chamber = this.world.createBody();
    const radius = tuning.stomachRadiusMeters;
    const sides = 28;
    for (let index = 0; index < sides; index += 1) {
      const startAngle = (index / sides) * Math.PI * 2;
      const endAngle = ((index + 1) / sides) * Math.PI * 2;
      chamber.createFixture(
        planck.Edge(
          planck.Vec2(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius),
          planck.Vec2(Math.cos(endAngle) * radius, Math.sin(endAngle) * radius),
        ),
      );
    }

    this.mixerBody = this.world.createBody({
      type: 'kinematic',
      position: planck.Vec2(0, 0),
    });
    this.mixerBody.createFixture(planck.Box(radius * 0.62, 0.04));
    this.mixerBody.createFixture(planck.Box(0.04, radius * 0.56));
  }

  add(resourceId: PickupResourceId): void {
    const definition = getPickupDefinition(resourceId);
    if (definition.stomachEffect === 'parasite') {
      this.parasiteSerial += 1;
      this.parasites.push(createActiveParasite(`parasite-${this.parasiteSerial}`));
      return;
    }

    while (this.particles.length >= tuning.stomachParticleLimit) {
      this.removeParticle(this.particles[0], true);
    }

    this.serial += 1;
    const radiusMeters = randomBetween(0.045, 0.08);
    const spawnAngle = randomBetween(0, Math.PI * 2);
    const spawnRadius =
      Math.sqrt(Math.random()) *
      Math.max(
        0.025,
        tuning.stomachRadiusMeters - radiusMeters - tuning.stomachContainmentMarginMeters,
      );
    const body = this.world.createDynamicBody({
      position: planck.Vec2(
        Math.cos(spawnAngle) * spawnRadius,
        Math.sin(spawnAngle) * spawnRadius,
      ),
      linearDamping: 0.32,
      angularDamping: 0.8,
    });
    body.createFixture({
      shape: planck.Circle(radiusMeters),
      density: 0.65,
      friction: 0.08,
      restitution: 0.22,
    });
    body.applyLinearImpulse(
      planck.Vec2(randomBetween(-0.18, 0.18), randomBetween(-0.12, 0.12)),
      body.getWorldCenter(),
      true,
    );

    this.particles.push({
      id: `matter-${this.serial}`,
      body,
      resourceId,
      tier: definition.tier,
      digestValue: definition.digestValue,
      radiusMeters,
    });
    this.biomass += definition.digestValue;
  }

  setAnchor(x: number, y: number): void {
    this.anchorX = x;
    this.anchorY = y;
  }

  getAnchor(): { x: number; y: number } {
    return {
      x: this.anchorX,
      y: this.anchorY,
    };
  }

  step(deltaSeconds: number): void {
    this.mixTime += deltaSeconds;
    const nextParasites = stepActiveParasites(
      this.parasites,
      deltaSeconds,
      tuning.parasiteLifetimeSeconds,
      tuning.parasiteConsumeIntervalSeconds,
      () => this.consumeOldestPickupForParasite(),
    );
    this.parasites.splice(0, this.parasites.length, ...nextParasites);
    const angle = Math.sin(this.mixTime * 0.9) * 0.55;
    this.mixerBody.setTransform(planck.Vec2(0, 0), angle);
    this.mixerBody.setAngularVelocity(Math.cos(this.mixTime * 1.1) * tuning.stomachMixerAngularSpeed);
    this.world.setGravity(
      planck.Vec2(
        Math.cos(this.mixTime * 0.6) * 0.32,
        Math.sin(this.mixTime * 0.84) * 0.22,
      ),
    );
    this.world.step(deltaSeconds);
    this.keepParticlesInside();
  }

  consumePickupsForGrowth(count: number): void {
    let remaining = count;
    let consumedBiomass = 0;
    let consumedPickups = 0;

    while (remaining > 0 && this.particles.length > 0) {
      const particle = this.particles[0];
      remaining -= 1;
      consumedPickups += 1;
      consumedBiomass += particle.digestValue;
      this.removeParticle(particle, false);
    }

    this.biomass = Math.max(0, this.biomass - consumedBiomass);
    this.digestedTotal += consumedBiomass;
    this.consumedPickupTotal += consumedPickups;
  }

  getActiveParasiteCount(): number {
    return this.parasites.length;
  }

  getParasiteAlertProgress(): number {
    return createParasiteAlertProgress(this.parasites.length, this.mixTime);
  }

  getUiParasiteSnapshots(): UiStomachParasiteSnapshot[] {
    return createUiParasiteSnapshots(this.parasites);
  }

  private removeParticle(particle: StomachParticle | undefined, shouldTrackRemoval = false): void {
    if (!particle) {
      return;
    }

    const index = this.particles.findIndex((candidate) => candidate.id === particle.id);
    if (index >= 0) {
      this.particles.splice(index, 1);
    }
    if (shouldTrackRemoval) {
      this.biomass = Math.max(0, this.biomass - particle.digestValue);
    }
    this.world.destroyBody(particle.body);
  }

  private consumeOldestPickupForParasite(): boolean {
    const particle = this.particles[0];
    if (!particle) {
      return false;
    }

    this.removeParticle(particle, true);
    return true;
  }

  private keepParticlesInside(): void {
    const radius = tuning.stomachRadiusMeters;
    for (const particle of this.particles) {
      const position = particle.body.getPosition();
      const distance = Math.hypot(position.x, position.y);
      const maxDistance =
        radius - particle.radiusMeters - tuning.stomachContainmentMarginMeters;
      if (distance > maxDistance) {
        const velocity = particle.body.getLinearVelocity();
        const nx = position.x / Math.max(distance, 0.0001);
        const ny = position.y / Math.max(distance, 0.0001);
        const tangentVelocityX = velocity.x - (velocity.x * nx + velocity.y * ny) * nx;
        const tangentVelocityY = velocity.y - (velocity.x * nx + velocity.y * ny) * ny;
        particle.body.setTransform(
          planck.Vec2(nx * maxDistance, ny * maxDistance),
          particle.body.getAngle(),
        );
        particle.body.setLinearVelocity(planck.Vec2(tangentVelocityX * 0.92, tangentVelocityY * 0.92));
      }
    }
  }
}
