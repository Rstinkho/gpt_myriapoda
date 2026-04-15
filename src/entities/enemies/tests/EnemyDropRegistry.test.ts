import { describe, expect, it } from 'vitest';
import { resolveEnemyDrops } from '@/entities/enemies/EnemyDropRegistry';

describe('EnemyDropRegistry', () => {
  it('gives jellyfish three biomass by default', () => {
    expect(resolveEnemyDrops('jellyfish', 0.5)).toEqual([
      'biomass',
      'biomass',
      'biomass',
    ]);
  });

  it('gives jellyfish a 10% chance to swap one biomass for tissue', () => {
    expect(resolveEnemyDrops('jellyfish', 0.05)).toEqual([
      'biomass',
      'biomass',
      'tissue',
    ]);
  });

  it('gives leeches a 20% chance to drop a single biomass', () => {
    expect(resolveEnemyDrops('leech', 0.5)).toEqual([]);
    expect(resolveEnemyDrops('leech', 0.1)).toEqual(['biomass']);
  });

  it('gives shellbacks a modest guaranteed tissue drop', () => {
    expect(resolveEnemyDrops('shellback', 0.5)).toEqual(['tissue', 'tissue']);
  });
});
