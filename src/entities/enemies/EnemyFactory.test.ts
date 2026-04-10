import { describe, expect, it } from 'vitest';
import { resolveEnemyType } from '@/entities/enemies/EnemyRegistry';

describe('EnemyFactory', () => {
  it('defaults spawned enemies to jellyfish', () => {
    expect(resolveEnemyType()).toBe('jellyfish');
  });
});
