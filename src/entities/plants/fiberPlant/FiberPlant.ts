import type Phaser from 'phaser';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import type { FixtureMeta, PlantState } from '@/game/types';
import type { Plant } from '@/entities/plants/Plant';
import { getPlantDefinition } from '@/entities/plants/PlantRegistry';
import {
  beginPlantChewing,
  canPlantHarvest,
  stepPlantLifecycle,
  type PlantLifecycleConfig,
} from '@/entities/plants/plantLifecycle';
import { FiberPlantView } from '@/entities/plants/fiberPlant/FiberPlantView';
import {
  pixelsToMeters,
  vec2FromPixels,
  vec2ToPixels,
} from '@/physics/PhysicsUtils';

export class FiberPlant implements Plant {
  readonly type = 'fiberPlant' as const;
  readonly harvestOutputs = getPlantDefinition('fiberPlant').harvestOutputs;
  readonly rootBody: planck.Body;
  readonly stemBodies: planck.Body[] = [];
  readonly joints: planck.Joint[] = [];
  readonly view: FiberPlantView;
  state: PlantState = 'grown';
  private stateElapsed = 0;
  private elapsed = 0;
  private growthScale = 1;
  private readonly phaseSeed: number;
  private readonly lifecycleConfig: PlantLifecycleConfig;

  constructor(
    scene: Phaser.Scene,
    world: planck.World,
    readonly id: string,
    readonly cellKey: string,
    x: number,
    y: number,
  ) {
    this.phaseSeed = (x * 0.013 + y * 0.009) % (Math.PI * 2);
    this.lifecycleConfig = {
      chewSeconds: tuning.fiberPlantChewSeconds,
      cooldownSeconds: tuning.fiberPlantCooldownSeconds,
      regrowSeconds: tuning.fiberPlantRegrowSeconds,
      baseGrowthScale: tuning.fiberPlantBaseGrowthScale,
      harvestOutputs: this.harvestOutputs,
    };
    this.rootBody = world.createBody({
      position: vec2FromPixels(x, y),
    });
    this.view = new FiberPlantView(scene, id);

    let previousBody = this.rootBody;
    for (let index = 0; index < tuning.fiberPlantStemCount; index += 1) {
      const spawnY = y - tuning.fiberPlantSegmentLengthPx * (index + 1);
      const body = world.createBody({
        type: 'dynamic',
        position: vec2FromPixels(x, spawnY),
        linearDamping: 6.4,
        angularDamping: 8.8,
      });
      const radiusPx =
        index === tuning.fiberPlantStemCount - 1
          ? tuning.fiberPlantTopRadiusPx
          : tuning.fiberPlantStemRadiusPx;
      const fixture = body.createFixture({
        shape: planck.Circle(pixelsToMeters(radiusPx)),
        density: 0.12,
        friction: 0.05,
        restitution: 0.02,
        isSensor: true,
      });
      if (index >= Math.max(0, tuning.fiberPlantStemCount - 2)) {
        fixture.setUserData({
          tag: 'plant-body',
          entityId: id,
        } satisfies FixtureMeta);
      }

      const previousPosition = previousBody.getPosition();
      const joint = world.createJoint(
        planck.RevoluteJoint(
          {
            enableLimit: true,
            lowerAngle: -Math.PI / 2.8,
            upperAngle: Math.PI / 2.8,
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

      this.stemBodies.push(body);
      previousBody = body;
    }
  }

  isHarvestable(): boolean {
    return canPlantHarvest(this.state);
  }

  beginChewing(): boolean {
    const nextState = beginPlantChewing(this.state);
    if (nextState === this.state) {
      return false;
    }

    this.state = nextState;
    this.stateElapsed = 0;
    return true;
  }

  getDropOriginPixels(): { x: number; y: number } {
    return vec2ToPixels(this.rootBody.getPosition());
  }

  getVacuumPointPixels(): { x: number; y: number } {
    return vec2ToPixels(this.getVacuumTargetWorld());
  }

  getVacuumPointWorld(): planck.Vec2 {
    return this.getVacuumTargetWorld();
  }

  applyVacuumForce(force: { x: number; y: number }): void {
    if (this.state === 'cooldown') {
      return;
    }

    for (let index = 0; index < this.stemBodies.length; index += 1) {
      const body = this.stemBodies[index];
      const ratio = (index + 1) / this.stemBodies.length;
      let forceScale: number = tuning.fiberPlantLowerVacuumForceScale;

      if (ratio >= 1) {
        forceScale = tuning.fiberPlantUpperVacuumForceScale;
      } else if (ratio >= 0.66) {
        const t = (ratio - 0.66) / 0.34;
        forceScale =
          tuning.fiberPlantMidVacuumForceScale +
          (tuning.fiberPlantUpperVacuumForceScale -
            tuning.fiberPlantMidVacuumForceScale) *
            t;
      } else {
        const t = ratio / 0.66;
        forceScale =
          tuning.fiberPlantLowerVacuumForceScale +
          (tuning.fiberPlantMidVacuumForceScale -
            tuning.fiberPlantLowerVacuumForceScale) *
            t;
      }

      body.applyForceToCenter(
        planck.Vec2(force.x * forceScale, force.y * forceScale),
        true,
      );
    }
  }

  step(deltaSeconds: number): ReturnType<Plant['step']> {
    this.elapsed += deltaSeconds;
    const next = stepPlantLifecycle(
      {
        state: this.state,
        stateElapsed: this.stateElapsed,
      },
      deltaSeconds,
      this.lifecycleConfig,
    );
    this.state = next.state;
    this.stateElapsed = next.stateElapsed;
    this.growthScale = next.growthScale;
    this.applyReturnForces();
    return next.emittedHarvestOutputs;
  }

  updateVisual(deltaSeconds: number): void {
    const stemPoints = this.stemBodies
      .slice(0, -1)
      .map((body) => vec2ToPixels(body.getPosition()));
    this.view.update(
      {
        anchor: vec2ToPixels(this.rootBody.getPosition()),
        stemPoints,
        top: this.getVacuumPointPixels(),
        growthScale: this.growthScale,
        state: this.state,
      },
      deltaSeconds,
    );
  }

  destroy(world: planck.World): void {
    for (const joint of this.joints) {
      world.destroyJoint(joint);
    }
    for (const body of this.stemBodies) {
      world.destroyBody(body);
    }
    world.destroyBody(this.rootBody);
    this.view.destroy();
  }

  private applyReturnForces(): void {
    const anchor = this.rootBody.getPosition();
    const baseSway =
      Math.sin(this.elapsed * 1.3 + this.phaseSeed) *
      pixelsToMeters(2.2) *
      this.growthScale;
    const chewSway =
      this.state === 'chewing'
        ? Math.sin(
            (this.stateElapsed / Math.max(0.001, this.lifecycleConfig.chewSeconds)) *
              Math.PI *
              6,
          ) * pixelsToMeters(2.8)
        : 0;

    for (let index = 0; index < this.stemBodies.length; index += 1) {
      const body = this.stemBodies[index];
      const ratio = (index + 1) / this.stemBodies.length;
      const target = planck.Vec2(
        anchor.x + baseSway * ratio + chewSway * ratio * 0.7,
        anchor.y -
          pixelsToMeters(
            tuning.fiberPlantSegmentLengthPx * (index + 1) * this.growthScale,
          ) +
          Math.abs(chewSway) * ratio * 0.18,
      );
      const position = body.getPosition();
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const forceScale = tuning.fiberPlantReturnForce * (1 + ratio * 0.4);
      body.applyForceToCenter(planck.Vec2(dx * forceScale, dy * forceScale), true);
      body.setAngularVelocity(body.getAngularVelocity() * 0.78);
    }
  }

  private getVacuumTargetWorld(): planck.Vec2 {
    const top = this.stemBodies[this.stemBodies.length - 1].getPosition();
    const upperMid =
      this.stemBodies[Math.max(0, this.stemBodies.length - 2)]?.getPosition() ??
      top;

    return planck.Vec2(
      top.x * 0.72 + upperMid.x * 0.28,
      top.y * 0.72 + upperMid.y * 0.28,
    );
  }
}
