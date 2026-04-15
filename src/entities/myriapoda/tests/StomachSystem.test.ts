import { describe, expect, it } from 'vitest';
import { StomachSystem } from '@/entities/myriapoda/StomachSystem';
import { tuning } from '@/game/tuning';

describe('StomachSystem', () => {
  it('stores parasites separately from nutrient particles', () => {
    const stomach = new StomachSystem();

    stomach.add('biomass');
    stomach.add('parasite');

    expect(stomach.particles).toHaveLength(1);
    expect(stomach.parasites).toHaveLength(1);
    expect(stomach.getResourceCounts()).toEqual({
      biomass: 1,
      tissue: 0,
      structuralCell: 0,
      parasite: 1,
    });
  });

  it('caps nutrient storage at fifty while still accepting parasites', () => {
    const stomach = new StomachSystem();

    for (let index = 0; index < tuning.stomachNutrientCapacity; index += 1) {
      expect(stomach.tryAdd('biomass')).toBe(true);
    }

    expect(stomach.tryAdd('biomass')).toBe(false);
    expect(stomach.particles).toHaveLength(tuning.stomachNutrientCapacity);

    expect(stomach.tryAdd('parasite')).toBe(true);
    expect(stomach.parasites).toHaveLength(1);
  });

  it('spends only the requested stored resources in oldest-first order', () => {
    const stomach = new StomachSystem();
    stomach.add('biomass');
    stomach.add('tissue');
    stomach.add('biomass');
    stomach.add('structuralCell');

    expect(
      stomach.spend({
        biomass: 2,
        tissue: 1,
      }),
    ).toBe(true);

    expect(stomach.particles.map((particle) => particle.resourceId)).toEqual([
      'structuralCell',
    ]);
    expect(stomach.getResourceCounts()).toEqual({
      biomass: 0,
      tissue: 0,
      structuralCell: 1,
      parasite: 0,
    });
  });

  it('does not mutate storage on failed spend', () => {
    const stomach = new StomachSystem();
    stomach.add('biomass');
    stomach.add('tissue');

    expect(
      stomach.spend({
        biomass: 2,
      }),
    ).toBe(false);

    expect(stomach.particles.map((particle) => particle.resourceId)).toEqual([
      'biomass',
      'tissue',
    ]);
  });

  it('consumes the oldest nutrient pickup every two seconds for active parasites', () => {
    const stomach = new StomachSystem();
    stomach.add('biomass');
    stomach.add('tissue');
    stomach.add('structuralCell');
    stomach.add('parasite');

    stomach.step(2);
    expect(stomach.particles.map((particle) => particle.resourceId)).toEqual([
      'tissue',
      'structuralCell',
    ]);

    stomach.step(4);
    expect(stomach.particles).toHaveLength(0);
    expect(stomach.parasites).toHaveLength(1);
  });
});
