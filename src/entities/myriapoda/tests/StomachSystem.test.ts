import { describe, expect, it } from 'vitest';
import { StomachSystem } from '@/entities/myriapoda/StomachSystem';
import { tuning } from '@/game/tuning';

describe('StomachSystem parasites', () => {
  it('stores parasites separately from nutrient particles', () => {
    const stomach = new StomachSystem();

    stomach.add('biomass');
    stomach.add('parasite');

    expect(stomach.particles).toHaveLength(1);
    expect(stomach.parasites).toHaveLength(1);
    expect(stomach.biomass).toBe(2);
  });

  it('consumes the oldest nutrient pickup every two seconds for twenty seconds', () => {
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
    expect(stomach.biomass).toBe(7);
    expect(stomach.digestedTotal).toBe(0);
    expect(stomach.consumedPickupTotal).toBe(0);

    stomach.step(4);
    expect(stomach.particles).toHaveLength(0);
    expect(stomach.biomass).toBe(0);
    expect(stomach.parasites).toHaveLength(1);

    stomach.step(14);
    expect(stomach.parasites).toHaveLength(0);
  });

  it('stacks parasites independently and keeps blinking state while active', () => {
    const stomach = new StomachSystem();
    stomach.add('biomass');
    stomach.add('biomass');
    stomach.add('biomass');
    stomach.add('parasite');
    stomach.add('parasite');

    stomach.step(2);

    expect(stomach.particles).toHaveLength(1);
    expect(stomach.parasites).toHaveLength(2);
    expect(stomach.getActiveParasiteCount()).toBe(2);
    expect(stomach.getParasiteAlertProgress()).toBeGreaterThan(0);
    expect(stomach.getUiParasiteSnapshots()).toHaveLength(2);
  });

  it('lets parasites expire even when there are no nutrients left to eat', () => {
    const stomach = new StomachSystem();
    stomach.add('parasite');

    for (let elapsed = 0; elapsed < tuning.parasiteLifetimeSeconds; elapsed += 1) {
      stomach.step(1);
    }

    expect(stomach.particles).toHaveLength(0);
    expect(stomach.parasites).toHaveLength(0);
    expect(stomach.biomass).toBe(0);
    expect(stomach.getParasiteAlertProgress()).toBe(0);
  });
});
