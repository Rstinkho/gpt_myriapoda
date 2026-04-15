import { describe, expect, it } from 'vitest';
import {
  getLeechSpawnShare,
  resolveEnemyType,
} from '@/entities/enemies/EnemyRegistry';

describe('EnemyFactory', () => {
  it('keeps stage 1 ambient spawns on jellyfish', () => {
    expect(resolveEnemyType(1, 0)).toBe('jellyfish');
    expect(getLeechSpawnShare(1)).toBe(0);
  });

  it('uses the planned leech spawn weights from stage 2 onward', () => {
    expect(getLeechSpawnShare(2)).toBe(0.25);
    expect(getLeechSpawnShare(3)).toBe(0.35);
    expect(getLeechSpawnShare(4)).toBe(0.45);
    expect(resolveEnemyType(2, 0.2)).toBe('leech');
    expect(resolveEnemyType(2, 0.3)).toBe('jellyfish');
  });
});
