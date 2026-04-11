import { describe, expect, it } from 'vitest';
import {
  getStrikeDirection,
  isCircleInStrikeCone,
  isPointInStrikeCone,
} from '@/systems/combat/strikeMath';

describe('strikeMath', () => {
  it('detects points inside a forward strike cone', () => {
    const root = { x: 0, y: 0 };
    const tip = { x: 10, y: 0 };
    const direction = getStrikeDirection(root, tip);

    expect(isPointInStrikeCone(tip, direction, { x: 24, y: 3 }, 18, Math.PI / 4)).toBe(true);
    expect(isPointInStrikeCone(tip, direction, { x: 6, y: 0 }, 18, Math.PI / 4)).toBe(false);
    expect(isPointInStrikeCone(tip, direction, { x: 18, y: 18 }, 18, Math.PI / 4)).toBe(false);
  });

  it('detects circle overlap when the cone border touches the enemy body', () => {
    const root = { x: 0, y: 0 };
    const tip = { x: 10, y: 0 };
    const direction = getStrikeDirection(root, tip);

    expect(isPointInStrikeCone(tip, direction, { x: 24, y: 17 }, 18, Math.PI / 4)).toBe(false);
    expect(isCircleInStrikeCone(tip, direction, { x: 24, y: 17 }, 6, 18, Math.PI / 4)).toBe(true);
  });
});
