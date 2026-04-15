import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEvents } from '@/game/events';
import { tuning } from '@/game/tuning';
import type { EnemySpawnContext, HexCell, PickupResourceId, PickupTier } from '@/game/types';

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
  destroy: vi.fn(),
  getSpawnableCells: vi.fn((cells) => cells),
  isExpansionActive: vi.fn(() => false),
  startExpansion: vi.fn(),
  update: vi.fn(),
};

vi.mock('phaser', () => ({
  Events: {
    EventEmitter: TestEventBus,
  },
  Scene: class Scene {},
}));

vi.mock('@/rendering/WorldRenderer', () => ({
  WorldRenderer: vi.fn().mockImplementation(() => ({
    addFillPulse: rendererState.addFillPulse,
    destroy: rendererState.destroy,
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
    create: vi.fn((spawn: EnemySpawnContext, type = 'jellyfish') => {
      serial += 1;
      const guardCell = spawn.guardCell ?? spawn.cell;
      return {
        id: `spawned-enemy-${serial}`,
        x: spawn.x,
        y: spawn.y,
        type,
        guardCellKey: `${guardCell.coord.q},${guardCell.coord.r}`,
      };
    }),
  };
}

function getSpawnCallsByType(
  enemyFactory: ReturnType<typeof createEnemyFactory>,
  type: string,
) {
  return enemyFactory.create.mock.calls.filter((call) => call[1] === type);
}

function advanceWorldToStage(worldSystem: WorldSystem, targetStage: number): void {
  while (worldSystem.world.stage < targetStage) {
    const expansion = worldSystem.world.addFill(worldSystem.world.fillThreshold);
    expect(expansion).not.toBeNull();
  }
}

describe('WorldSystem', () => {
  beforeEach(() => {
    rendererState.addFillPulse.mockClear();
    rendererState.destroy.mockClear();
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

  it('restores normal stage 1 ambient spawning before shellbacks unlock', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map();
    const rolls = [0.95, 0.6, 0.6];
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

    worldSystem.update({ x: 0, y: 0 });

    expect(enemyFactory.create).toHaveBeenCalled();
    expect(enemyFactory.create.mock.calls[0][1]).toBe('jellyfish');
    expect(getSpawnCallsByType(enemyFactory, 'shellback')).toHaveLength(0);
  });

  it('spawns shellbacks on enriched hexes once stage 3 is active', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map<string, unknown>();
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
        randomFloat: () => 0.6,
      },
    );
    advanceWorldToStage(worldSystem, 3);

    worldSystem.update({ x: 0, y: 0 });

    const shellbackCalls = getSpawnCallsByType(enemyFactory, 'shellback');
    expect(shellbackCalls).toHaveLength(1);
    expect(shellbackCalls[0][0].guardCell?.type).toBe('enriched');
  });

  it('respawns a killed shellback only after the full cooldown elapses', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map<string, unknown>();
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
        randomFloat: () => 0.6,
      },
    );
    advanceWorldToStage(worldSystem, 3);

    worldSystem.update({ x: 0, y: 0 });
    expect(getSpawnCallsByType(enemyFactory, 'shellback')).toHaveLength(1);

    enemyFactory.create.mockClear();
    enemies.clear();
    eventBus.emit(GameEvents.enemyKilled, {
      enemyType: 'shellback',
      x: 0,
      y: 0,
    });

    const respawnFrames =
      Math.ceil(tuning.shellbackRespawnDelaySeconds / tuning.fixedStepSeconds);
    for (let frame = 0; frame < respawnFrames - 1; frame += 1) {
      worldSystem.update({ x: 0, y: 0 });
    }

    expect(getSpawnCallsByType(enemyFactory, 'shellback')).toHaveLength(0);

    worldSystem.update({ x: 0, y: 0 });

    expect(getSpawnCallsByType(enemyFactory, 'shellback')).toHaveLength(1);
  });

  it('passes leech explicitly once stage 2 spawning is active', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map();
    const rolls = [0.95, 0.1, 0.6, 0.6];
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
        randomFloat: () => rolls.shift() ?? 0.6,
      },
    );
    worldSystem.world.stage = 2;

    worldSystem.update({ x: 0, y: 0 });

    expect(enemyFactory.create).toHaveBeenCalled();
    expect(enemyFactory.create.mock.calls[0][1]).toBe('leech');
  });

  it('does not spawn a second shellback while one is already active but still restores ambient enemies', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map<string, unknown>();
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
    advanceWorldToStage(worldSystem, 3);

    enemies.set('existing-shellback', {
      id: 'existing-shellback',
      type: 'shellback',
      guardCellKey: '0,0',
    });

    worldSystem.update({ x: 0, y: 0 });

    expect(getSpawnCallsByType(enemyFactory, 'shellback')).toHaveLength(0);
    expect(enemyFactory.create).toHaveBeenCalled();
    expect(enemyFactory.create.mock.calls.every((call) => call[1] !== 'shellback')).toBe(true);
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

  it('allows conquest only on dead hexes and marks the completed hex as owned', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map<string, unknown>();
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
    const deadCell = worldSystem.world.cells.find((cell) => cell.type === 'dead');
    const purifiedCell = worldSystem.world.cells.find((cell) => cell.type === 'purified');

    expect(deadCell).toBeDefined();
    expect(purifiedCell).toBeDefined();
    expect(worldSystem.canStartConquest(purifiedCell!.coord).allowed).toBe(false);
    expect(worldSystem.canStartConquest(deadCell!.coord).allowed).toBe(true);
    expect(worldSystem.startConquest(deadCell!.coord)).toBe(true);

    worldSystem.setSpawningSuppressed(true);
    while ((worldSystem.getConquestProgress()?.killCount ?? 0) < tuning.conquerKillGoal) {
      worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });
      for (const enemyId of [...enemies.keys()]) {
        enemies.delete(enemyId);
        eventBus.emit(GameEvents.enemyKilled, {
          enemyId,
          enemyType: 'leech',
          x: deadCell!.centerX,
          y: deadCell!.centerY,
        });
      }
    }

    const occupancyFrames = Math.ceil(
      tuning.conquerOccupancySeconds / tuning.fixedStepSeconds,
    );
    for (let frame = 0; frame < occupancyFrames; frame += 1) {
      worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });
      if (!worldSystem.getConquestProgress()) {
        break;
      }
    }

    expect(worldSystem.getConquestProgress()).toBeNull();
    expect(worldSystem.world.getOwnedCell()?.coord).toEqual(deadCell!.coord);
    expect(worldSystem.world.getOwnedCell()?.buildable).toBe(true);
    expect(worldSystem.canStartConquest(deadCell!.coord).allowed).toBe(false);
  });

  it('buffers fill while conquest is active and flushes it only after conquest resolves', () => {
    const eventBus = new TestEventBus();
    const pickupFactory = createPickupFactory();
    const plantFactory = createPlantFactory();
    const enemyFactory = createEnemyFactory();
    const pickups = new Map();
    const plants = new Map();
    const enemies = new Map<string, unknown>();
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
    const deadCell = worldSystem.world.cells.find((cell) => cell.type === 'dead');
    expect(deadCell).toBeDefined();
    expect(worldSystem.startConquest(deadCell!.coord)).toBe(true);

    worldSystem.setSpawningSuppressed(true);
    eventBus.emit(GameEvents.pickupAbsorbed, {
      digestValue: worldSystem.world.fillThreshold,
    });
    worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });

    expect(rendererState.startExpansion).not.toHaveBeenCalled();

    while ((worldSystem.getConquestProgress()?.killCount ?? 0) < tuning.conquerKillGoal) {
      worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });
      for (const enemyId of [...enemies.keys()]) {
        enemies.delete(enemyId);
        eventBus.emit(GameEvents.enemyKilled, {
          enemyId,
          enemyType: 'leech',
          x: deadCell!.centerX,
          y: deadCell!.centerY,
        });
      }
    }

    const occupancyFrames = Math.ceil(
      tuning.conquerOccupancySeconds / tuning.fixedStepSeconds,
    );
    for (let frame = 0; frame < occupancyFrames; frame += 1) {
      worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });
      if (!worldSystem.getConquestProgress()) {
        break;
      }
    }

    expect(rendererState.startExpansion).not.toHaveBeenCalled();

    worldSystem.update({ x: deadCell!.centerX, y: deadCell!.centerY });

    expect(rendererState.startExpansion).toHaveBeenCalledTimes(1);
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
