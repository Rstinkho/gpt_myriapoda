import { describe, expect, it } from 'vitest';
import { isInsideVacuumCone, resolveVacuumPull } from '@/systems/vacuumMath';

describe('vacuumMath', () => {
  it('absorbs pickups once they are inside the absorb radius', () => {
    const result = resolveVacuumPull({ x: 5, y: 0 }, { x: 0, y: 0 }, 10, 50);
    expect(result.shouldAbsorb).toBe(true);
  });

  it('returns a force scale when the pickup is nearby but not absorbed', () => {
    const result = resolveVacuumPull({ x: 20, y: 0 }, { x: 0, y: 0 }, 10, 50);
    expect(result.shouldAbsorb).toBe(false);
    expect(result.forceScale).toBeGreaterThan(0);
  });

  it('allows oversized pickups to absorb once they reach the mouth edge', () => {
    const result = resolveVacuumPull(
      { x: 17, y: 0 },
      { x: 0, y: 0 },
      14,
      50,
      17,
    );
    expect(result.shouldAbsorb).toBe(true);
  });

  it('rejects pickups behind the head cone', () => {
    expect(isInsideVacuumCone({ x: 30, y: 0 }, { x: 0, y: 0 }, 0, 96, 0.7)).toBe(true);
    expect(isInsideVacuumCone({ x: -30, y: 0 }, { x: 0, y: 0 }, 0, 96, 0.7)).toBe(false);
  });

  it('accepts pickups slightly wider within the larger front cone', () => {
    expect(isInsideVacuumCone({ x: 78, y: 32 }, { x: 0, y: 0 }, 0, 96, 0.7)).toBe(true);
    expect(isInsideVacuumCone({ x: 78, y: 70 }, { x: 0, y: 0 }, 0, 96, 0.7)).toBe(false);
  });
});
