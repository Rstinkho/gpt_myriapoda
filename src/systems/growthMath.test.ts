import { describe, expect, it } from 'vitest';
import { resolveGrowth } from '@/systems/growthMath';

describe('growthMath', () => {
  it('converts stored pickups into new segments until the cap', () => {
    const result = resolveGrowth(120, 12, 30, 50);
    expect(result.segmentsAdded).toBe(2);
    expect(result.nextStoredPickups).toBe(20);
  });
});
