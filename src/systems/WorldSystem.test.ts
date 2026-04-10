import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEvents } from '@/game/events';
import { tuning } from '@/game/tuning';
import type { HexCell, PickupResourceId, PickupTier } from '@/game/types';

interface ListenerRecord {
  handler: (payload?: unknown) => void;
  context?: unknown;
}

class TestEventBus {
  private readonly listeners = new Map<string, ListenerRecord[]>();

  on(event: string, handler: (payload?: unknown) => void, context?: unknown): this {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push({ handler, context });
    this.listeners.set(event, handlers);
    return this;
  }

  off(event: string, handler: (payload?: unknown) => void, context?: unknown): this {
    const handlers = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      handlers.filter(
        (entry) => entry.handler !== handler || entry.context !== context,
      ),
    );
    return this;
  }

  emit(event: string, payload?: unknown): boolean {
    const handlers = this.listeners.get(event) ?? [];
    for (const entry of handlers) {
      entry.handler.call(entry.context, payload);
    }
    return handlers.length > 0;
  }
}

const rendererState = {
  addFillPulse: vi.fn(),
  getSpawnableCells: vi.fn((cells) => cells),
  isExpansionActive: vi.fn(() => false),
  startExpansion: vi.fn(),
  update: vi.fn(),
};

vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: TestEventBus,
    },
    Scene: class Scene {},
  },
}));

vi.mock('@/rendering/WorldRenderer', () => ({
  WorldRenderer: vi.fn().mockImplementation(() => ({
    addFillPulse: rendererState.addFillPulse,
    getSpawnableCells: rendererState.getSpawnableCells,
    isExpansionActive: rendererState.isExpansionActive,
    startExpansion: rendererState.startExpansion,
    update: rendererState.update,
  })),
}));

import { WorldSystem } from '@/systems/WorldSystem';

function createEnemyMap(count: number): Map<string, unknown> {
  const enemies = new Map<string, unknown>();
  for (let index = 0; index < count; index += 1) {
    enemies.set(`enemy-${index}`, { id: `enemy-${index}` });
  }
  return enemies;
}

function createPickupFactory() {
  let serial = 0;
  return {
    create: vi.fn(
      (
        _x: number,
        _y: number,
        _tier: PickupTier,
        options: { resourceId?: PickupResourceId } = {},
      ) => {
      serial += 1;
      return {
        id: `pickup-${serial}`,
        options,
      };
      },
    ),
  };
}

function createPlantFactory() {
  let serial = 0;
  return {
    create: vi.fn((cell: HexCell, type = 'fiberPlant') => {
      serial += 1;
      return {
        id: `plant-${serial}`,
        cellKey: `${cell.coord.q},${cell.coord.r}`,
        type,
        state: 'grown',
      };
    }),
  };
}

function createEnemyFactory() {
  let serial = 0;
  return {
    create: vi.fn((x: number, y: number) => {
      serial += 1;
      return {
        id: `spawned-enemy-${serial}`,
        x,
        y,
      };
    }),
  };
}

describe('WorldSystem', () => {
  beforeEach(() => {
    rendererState.addFillPulse.mockClear();
    rendererState.getSpawnableCells.mockClear();
    rendererState.getSpawnableCells.mockImplementation((cells) => cells);
    rendererState.isExpansionActive.mockClear();
    rendererState.isExpansionActive.mockReturnValue(false);
    rendererState.startExpansion.mockClear();
    rendererState.update.mockClear();
  });

  it('does not spawn ambient pickups during world updates', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => 0.95,
      },
    );

    worldSystem.update({ x: 0, y: 0 });

    expect(pickupFactory.create).not.toHaveBeenCalled();
    expect(pickups.size).toBe(0);
  });

  it('spawns plants only on purified hexes and only once per occupied slot', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => 0.5,
      },
    );

    worldSystem.update({ x: 0, y: 0 });
    worldSystem.update({ x: 0, y: 0 });

    expect(plantFactory.create).toHaveBeenCalledTimes(1);
    expect(plantFactory.create.mock.calls[0][0].type).toBe('purified');
    expect(plantFactory.create.mock.calls[0][1]).toBe('fiberPlant');
    expect(plants.size).toBe(1);
  });

  it('rolls purified-hex plant occupancy once and leaves failed slots empty', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const rolls = [0.95, 0.2, 0.2];
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => rolls.shift() ?? 0.2,
      },
    );

    worldSystem.update({ x: 0, y: 0 });
    worldSystem.update({ x: 0, y: 0 });

    expect(plantFactory.create).not.toHaveBeenCalled();
    expect(plants.size).toBe(0);
  });

  it('suppresses plant and enemy spawning while stage-transition respawns are paused', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map();
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => 0.5,
      },
    );

    worldSystem.setSpawningSuppressed(true);
    worldSystem.update({ x: 0, y: 0 });

    expect(plantFactory.create).not.toHaveBeenCalled();
    expect(enemyFactory.create).not.toHaveBeenCalled();
  });

  it('releases occupied plant slots so purified hexes can respawn after a transition', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => 0.5,
      },
    );

    worldSystem.update({ x: 0, y: 0 });
    plants.clear();
    worldSystem.releasePlantOccupants();
    worldSystem.update({ x: 0, y: 0 });

    expect(plantFactory.create).toHaveBeenCalledTimes(2);
    expect(plants.size).toBe(1);
  });

  it('drops three biomass when a jellyfish dies on the default roll path', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => 0.5,
      },
    );

    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'jellyfish',
      x: 40,
      y: 24,
    });

    expect(pickupFactory.create).toHaveBeenCalledTimes(3);
    expect(
      pickupFactory.create.mock.calls.map((call) => call[3]?.resourceId),
    ).toEqual(['biomass', 'biomass', 'biomass']);
    expect(pickups.size).toBe(3);
  });

  it('drops two biomass and one tissue on the jellyfish bonus roll path', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: (() => {
          const rolls = [0.05, 0.2];
          return () => rolls.shift() ?? 0.2;
        })(),
      },
    );

    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'jellyfish',
      x: 40,
      y: 24,
    });

    expect(pickupFactory.create).toHaveBeenCalledTimes(3);
    expect(
      pickupFactory.create.mock.calls.map((call) => call[3]?.resourceId),
    ).toEqual(['biomass', 'biomass', 'tissue']);
    expect(pickups.size).toBe(3);
  });

  it('adds a parasite bonus drop on the enemy parasite roll path', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = createEnemyMap(tuning.enemyCap);
    const rolls = [0.5, 0.05];
    const worldSystem = new WorldSystem(
      {} as never,
      eventBus as never,
      pickupFactory as never,
      plantFactory as never,
      enemyFactory as never,
      pickups as never,
      plants as never,
      enemies as never,
      {
        chooseIndex: () => 0,
        randomFloat: () => rolls.shift() ?? 0.5,
      },
    );

    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'jellyfish',
      x: 40,
      y: 24,
    });

    expect(pickupFactory.create).toHaveBeenCalledTimes(4);
    expect(
      pickupFactory.create.mock.calls.map((call) => call[3]?.resourceId),
    ).toEqual(['biomass', 'biomass', 'biomass', 'parasite']);
    expect(pickups.size).toBe(4);
  });
});
