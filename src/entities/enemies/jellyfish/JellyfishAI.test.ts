import { describe, expect, it } from 'vitest';
import {
  clampEnemyVelocity,
  createJellyfishSteering,
} from '@/entities/enemies/jellyfish/JellyfishAI';

describe('JellyfishAI', () => {
  it('still trends toward the target while drifting', () => {
    const steering = createJellyfishSteering(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      1,
      0.75,
      0.4,
    );

    expect(steering.forceX).toBeGreaterThan(0);
  });

  it('keeps drift from reversing the overall chase intent', () => {
    const steering = createJellyfishSteering(
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      1,
      2.2,
      2.7,
    );

    expect(steering.forceY).toBeGreaterThan(0);
  });

  it('clamps velocity to the configured max speed', () => {
    const clamped = clampEnemyVelocity({ x: 6, y: 8 }, 5);
    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(5, 5);
  });
});
