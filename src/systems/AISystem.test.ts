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
      linearDamping: tuning.enemyLinearDamping,
      angularDamping: tuning.enemyAngularDamping,
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
      updateVisual() {},
      destroy() {},
    } as Enemy;
    const enemies = new Map<string, Enemy>([['enemy-1', enemy]]);
    const system = new AISystem();

    for (let step = 0; step < 240; step += 1) {
      system.update(enemies, { x: 12, y: 0 });
      world.step(tuning.fixedStepSeconds);

      const velocity = body.getLinearVelocity();
      expect(Math.hypot(velocity.x, velocity.y)).toBeLessThanOrEqual(tuning.enemyMaxSpeed + 0.0001);
    }
  });
});
