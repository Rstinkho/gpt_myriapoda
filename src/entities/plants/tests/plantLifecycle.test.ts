import { describe, expect, it } from 'vitest';
import {
  beginPlantChewing,
  canPlantHarvest,
  shouldBeginPlantHarvest,
  shouldOccupyPurifiedHex,
  stepPlantLifecycle,
  type PlantLifecycleConfig,
} from '@/entities/plants/plantLifecycle';

const fiberPlantLifecycle: PlantLifecycleConfig = {
  chewSeconds: 0.85,
  cooldownSeconds: 18,
  regrowSeconds: 1.8,
  baseGrowthScale: 0.28,
  harvestOutputs: ['biomass', 'biomass'],
};

describe('plantLifecycle', () => {
  it('only begins harvesting when the plant is grown, in vacuum, and close enough', () => {
    expect(shouldBeginPlantHarvest('grown', true, 19, 20)).toBe(true);
    expect(shouldBeginPlantHarvest('grown', false, 19, 20)).toBe(false);
    expect(shouldBeginPlantHarvest('grown', true, 21, 20)).toBe(false);
    expect(shouldBeginPlantHarvest('cooldown', true, 10, 20)).toBe(false);
  });

  it('emits harvest outputs once, blocks repeat harvest during cooldown, and regrows', () => {
    expect(canPlantHarvest('grown')).toBe(true);

    const chewingState = beginPlantChewing('grown');
    expect(chewingState).toBe('chewing');
    expect(beginPlantChewing(chewingState)).toBe('chewing');

    const afterChew = stepPlantLifecycle(
      {
        state: chewingState,
        stateElapsed: 0,
      },
      fiberPlantLifecycle.chewSeconds,
      fiberPlantLifecycle,
    );
    expect(afterChew.state).toBe('cooldown');
    expect(afterChew.emittedHarvestOutputs).toEqual(['biomass', 'biomass']);
    expect(canPlantHarvest(afterChew.state)).toBe(false);

    const afterCooldown = stepPlantLifecycle(
      {
        state: afterChew.state,
        stateElapsed: 0,
      },
      fiberPlantLifecycle.cooldownSeconds,
      fiberPlantLifecycle,
    );
    expect(afterCooldown.state).toBe('regrowing');
    expect(afterCooldown.emittedHarvestOutputs).toBeNull();
    expect(canPlantHarvest(afterCooldown.state)).toBe(false);

    const afterRegrow = stepPlantLifecycle(
      {
        state: afterCooldown.state,
        stateElapsed: 0,
      },
      fiberPlantLifecycle.regrowSeconds,
      fiberPlantLifecycle,
    );
    expect(afterRegrow.state).toBe('grown');
    expect(afterRegrow.emittedHarvestOutputs).toBeNull();
    expect(canPlantHarvest(afterRegrow.state)).toBe(true);
  });

  it('rolls purified-hex occupancy against the configured chance', () => {
    expect(shouldOccupyPurifiedHex(0.79, 0.8)).toBe(true);
    expect(shouldOccupyPurifiedHex(0.8, 0.8)).toBe(false);
  });
});
