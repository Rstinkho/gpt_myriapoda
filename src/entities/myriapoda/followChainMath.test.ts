import { describe, expect, it } from 'vitest';
import type { Segment } from '@/game/types';
import { updateFollowSegments } from '@/entities/myriapoda/followChainMath';

describe('followChainMath', () => {
  it('keeps each segment near its desired spacing', () => {
    const segments: Segment[] = Array.from({ length: 4 }, (_, index) => ({
      x: index * 20,
      y: 0,
      angle: 0,
      radius: 10,
    }));

    const result = updateFollowSegments(segments, 100, 0, 0, {
      spacing: 18,
      stiffness: 1,
    });

    for (let index = 1; index < result.length; index += 1) {
      const leader = result[index - 1];
      const current = result[index];
      expect(Math.hypot(current.x - leader.x, current.y - leader.y)).toBeCloseTo(18, 3);
    }
  });
});
