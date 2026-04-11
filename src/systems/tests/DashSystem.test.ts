import { describe, expect, it } from 'vitest';
import * as planck from 'planck';
import { tuning } from '@/game/tuning';
import { DashSystem } from '@/systems/DashSystem';

describe('DashSystem', () => {
  it('starts a dash, applies burst velocity, and respects cooldown', () => {
    const world = new planck.World({ gravity: planck.Vec2(0, 0) });
    const body = world.createBody({
      type: 'dynamic',
      position: planck.Vec2(0, 0),
    });
    const dash = new DashSystem();

    const started = dash.step(
      body,
      {
        aimAngle: 0,
        thrust: 1,
        strafeX: 1,
        strafeY: 0,
      },
      true,
    );

    expect(started).toBe(true);
    expect(body.getLinearVelocity().x).toBeGreaterThan(0);
    expect(dash.getStateSnapshot().isReady).toBe(false);

    const secondStart = dash.step(
      body,
      {
        aimAngle: 0,
        thrust: 1,
        strafeX: 1,
        strafeY: 0,
      },
      true,
    );
    expect(secondStart).toBe(false);

    const stepsToReady = Math.ceil(
      tuning.dashCooldownSeconds / tuning.fixedStepSeconds,
    );
    for (let step = 0; step < stepsToReady; step += 1) {
      dash.step(
        body,
        {
          aimAngle: 0,
          thrust: 0,
          strafeX: 0,
          strafeY: 0,
        },
        false,
      );
    }

    expect(dash.getStateSnapshot().isReady).toBe(true);
  });
});
