import { describe, expect, it } from 'vitest';
import * as planck from 'planck';
import type { Enemy } from '@/entities/enemies/Enemy';
import { tuning } from '@/game/tuning';
import { AISystem } from '@/systems/AISystem';

describe('AISystem', () => {
  it('keeps enemy speed clamped under repeated steering', () => {
    const world = new planck.World({ gravity: planck.Vec2(0, 0) });
    const body = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(0, 0),
      linearDamping: tuning.jellyfishLinearDamping,
      angularDamping: tuning.jellyfishAngularDamping,
    });
    body.createFixture({
      shape: planck.Circle(0.25),
      density: 1,
    });

    const enemy = {
      id: 'enemy-1',
      type: 'jellyfish',
      body,
      health: 1,
      radiusPx: tuning.jellyfishRadius,
      updateVisual() {},
      destroy() {},
    } as Enemy;
    const enemies = new Map<string, Enemy>([['enemy-1', enemy]]);
    const system = new AISystem();
    const headBody = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(12, 0),
    });
    const myriapoda = {
      head: { body: headBody },
      body: {
        getStomachLatchPoint() {
          return { x: 0, y: 0, angle: 0, slotIndex: 0 };
        },
      },
      stomach: {
        getAnchor() {
          return { x: 0, y: 0 };
        },
        hasStoredParticles() {
          return false;
        },
        consumeOldestStoredParticle() {
          return false;
        },
      },
    } as never;

    for (let step = 0; step < 240; step += 1) {
      system.update(enemies, myriapoda, {
        cooldownSeconds: 0,
        cooldownProgress: 1,
        isReady: true,
        isActive: false,
        shakeStrength: 0,
        motionStrength: 0,
        phase: 0,
        directionX: 1,
        directionY: 0,
      });
      world.step(tuning.fixedStepSeconds);

      const velocity = body.getLinearVelocity();
      expect(Math.hypot(velocity.x, velocity.y)).toBeLessThanOrEqual(
        tuning.jellyfishMaxSpeed + 0.0001,
      );
    }
  });
});
