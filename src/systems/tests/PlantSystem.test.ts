import { describe, expect, it, vi } from 'vitest';
import { tuning } from '@/game/tuning';
import { PlantSystem } from '@/systems/PlantSystem';

class TestEventBus {
  emit(): boolean {
    return true;
  }
}

describe('PlantSystem parasite drops', () => {
  it('keeps normal plant harvest outputs and adds a parasite bonus on a successful roll', () => {
    const plantSystem = new PlantSystem(new TestEventBus() as never);
    const pickups = new Map<string, unknown>();
    const createdResources: string[] = [];
    const pickupFactory = {
      create: vi.fn(
        (
          _x: number,
          _y: number,
          _tier: string,
          options: { resourceId?: string } = {},
        ) => {
          const resourceId = options.resourceId ?? 'biomass';
          createdResources.push(resourceId);
          return { id: `pickup-${createdResources.length}` };
        },
      ),
    };
    const plant = {
      id: 'plant-1',
      type: 'fiberPlant',
      cellKey: '0,0',
      state: 'grown',
      harvestOutputs: ['biomass', 'biomass'],
      isHarvestable: () => true,
      beginChewing: () => false,
      getDropOriginPixels: () => ({ x: 12, y: 18 }),
      getVacuumPointPixels: () => ({ x: 400, y: 400 }),
      getVacuumPointWorld: () => ({ x: 0, y: 0 }),
      applyVacuumForce: vi.fn(),
      step: vi.fn(() => ['biomass', 'biomass']),
      updateVisual: vi.fn(),
      destroy: vi.fn(),
    };
    const myriapoda = {
      head: {
        body: {
          getPosition: () => ({ x: 0, y: 0 }),
          getAngle: () => 0,
        },
      },
    };

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05);

    try {
      plantSystem.update(
        myriapoda as never,
        new Map([[plant.id, plant]]) as never,
        new Set<string>(),
        pickups as never,
        pickupFactory as never,
      );
    } finally {
      randomSpy.mockRestore();
    }

    expect(createdResources).toEqual(['biomass', 'biomass', 'parasite']);
    expect(pickups.size).toBe(3);
    expect(plant.step).toHaveBeenCalledWith(tuning.fixedStepSeconds);
  });
});
