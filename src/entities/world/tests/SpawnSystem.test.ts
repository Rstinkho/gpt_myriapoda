import { describe, expect, it } from 'vitest';
import { enforceEnemyCap } from '@/entities/world/SpawnSystem';

describe('SpawnSystem', () => {
  it('enforces the enemy cap', () => {
    expect(enforceEnemyCap(3, 10)).toBe(7);
    expect(enforceEnemyCap(12, 10)).toBe(0);
  });
});
