import { describe, expect, it } from 'vitest';
import { selectTarget } from '@/systems/combat/targeting';

describe('targeting', () => {
  it('prioritizes enemies threatening the head before distance', () => {
    const target = selectTarget([
      { id: 'near', distanceSq: 1, health: 3, threateningHead: false },
      { id: 'threat', distanceSq: 9, health: 3, threateningHead: true },
    ]);

    expect(target).toBe('threat');
  });
});
