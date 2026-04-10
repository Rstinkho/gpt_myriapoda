import { describe, expect, it } from 'vitest';
import { getPlayerInfluence } from '@/rendering/worldCellMath';

describe('worldCellMath', () => {
  it('returns full influence at the player and none outside the radius', () => {
    expect(getPlayerInfluence(10, 10, 10, 10, 120)).toBeCloseTo(1, 5);
    expect(getPlayerInfluence(200, 10, 10, 10, 120)).toBe(0);
  });

  it('decays player influence smoothly with distance', () => {
    const near = getPlayerInfluence(30, 10, 10, 10, 120);
    const mid = getPlayerInfluence(70, 10, 10, 10, 120);
    const far = getPlayerInfluence(110, 10, 10, 10, 120);

    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});
