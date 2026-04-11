import { describe, expect, it } from 'vitest';
import { appendParasiteBonusDrop } from '@/entities/pickups/harmful/parasite';

describe('parasiteDrops', () => {
  it('keeps the original drops when the parasite roll misses', () => {
    expect(appendParasiteBonusDrop(['biomass', 'tissue'], 0.2, 0.15)).toEqual([
      'biomass',
      'tissue',
    ]);
  });

  it('appends a parasite when the parasite roll succeeds', () => {
    expect(appendParasiteBonusDrop(['biomass', 'tissue'], 0.05, 0.15)).toEqual([
      'biomass',
      'tissue',
      'parasite',
    ]);
  });
});
